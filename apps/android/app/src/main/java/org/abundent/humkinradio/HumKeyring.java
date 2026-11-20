package org.abundent.humkinradio;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.math.BigInteger;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/**
 * Invisible, device-held P-256 wallet key.
 * Key controls access to one nontransferable HUM wallet. It does not prove
 * personhood, listening authenticity or authorship. No private key or
 * user-specific token is sent to the server.
 */
final class HumKeyring {
    private static final String ALIAS="humkin-hum-server-key-v1";
    private static final String DOMAIN="HUMKIN-HUM/v1";
    private static final SecureRandom RAND=new SecureRandom();
    private HumKeyring(){}

    private static KeyStore store() throws Exception {
        KeyStore s=KeyStore.getInstance("AndroidKeyStore");
        s.load(null);
        return s;
    }
    private static void ensure() throws Exception {
        if(store().containsAlias(ALIAS))return;
        KeyPairGenerator gen=KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");
        gen.initialize(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false).build());
        gen.generateKeyPair();
    }
    private static byte[] fixed32(BigInteger x) {
        byte[] in=x.toByteArray(),out=new byte[32];
        int count=Math.min(32,in.length);
        System.arraycopy(in,in.length-count,out,32-count,count);
        return out;
    }
    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    static synchronized JSONObject jwk() throws Exception {
        ensure();
        ECPublicKey pub=(ECPublicKey)store().getCertificate(ALIAS).getPublicKey();
        return new JSONObject().put("kty","EC").put("crv","P-256")
            .put("x",b64(fixed32(pub.getW().getAffineX())))
            .put("y",b64(fixed32(pub.getW().getAffineY())));
    }
    static String hex(byte[] bytes) {
        StringBuilder s=new StringBuilder(bytes.length*2);
        for(byte b:bytes)s.append(String.format(java.util.Locale.US,"%02x",b&255));
        return s.toString();
    }
    static String actor(JSONObject key) throws Exception {
        // Make the JWK field order explicit. WebCrypto's server fingerprint
        // is the SHA256 of this exact UTF8 representation.
        String ordered="{\"kty\":\"EC\",\"crv\":\"P-256\",\"x\":\""+
            key.getString("x")+"\",\"y\":\""+key.getString("y")+"\"}";
        return hex(MessageDigest.getInstance("SHA-256")
            .digest(ordered.getBytes(StandardCharsets.UTF_8)));
    }
    static String nonce() {
        byte[] n=new byte[16];RAND.nextBytes(n);return hex(n);
    }
    /**
     * Android SHA256withECDSA emits ASN.1 DER. WebCrypto verification expects
     * the 64-byte IEEE P1363 pair. Reject malformed lengths/leading bytes.
     */
    static byte[] derToRaw(byte[] der) {
        if(der==null||der.length<8||der[0]!=0x30)
            throw new IllegalArgumentException("Bad ECDSA DER");
        int at=1,length=der[at++]&255;
        if(length==0x81){length=der[at++]&255;}
        else if(length==0x82){length=((der[at++]&255)<<8)|(der[at++]&255);}
        if(length!=der.length-at)throw new IllegalArgumentException("Bad DER envelope");
        byte[] result=new byte[64];
        for(int index=0;index<2;index++){
            if(at>=der.length||der[at++]!=0x02)
                throw new IllegalArgumentException("Bad DER integer");
            int size=der[at++]&255;
            if(size<1||size>33||at+size>der.length)
                throw new IllegalArgumentException("Bad DER length");
            int skip=size==33&&der[at]==0?1:0;
            if(size-skip>32)throw new IllegalArgumentException("Bad DER width");
            System.arraycopy(der,at+skip,result,index*32+32-(size-skip),size-skip);
            at+=size;
        }
        if(at!=der.length)throw new IllegalArgumentException("Trailing DER");
        return result;
    }
    static synchronized JSONObject request(String action,long playedMs,String song) throws Exception {
        if(!("register".equals(action)||"state".equals(action)||
             "listen".equals(action)||"collect".equals(action)))
            throw new IllegalArgumentException("Unsupported wallet action");
        JSONObject key=jwk();
        String owner=actor(key),nonce=nonce();
        long ts=System.currentTimeMillis();
        long time="listen".equals(action)?playedMs:0;
        String songId="collect".equals(action)?song:"";
        String signed=DOMAIN+"\n"+owner+"\n"+nonce+"\n"+ts+"\n"+action+
                "\n"+time+"\n"+songId;
        Signature signer=Signature.getInstance("SHA256withECDSA");
        signer.initSign((java.security.PrivateKey)store().getKey(ALIAS,null));
        signer.update(signed.getBytes(StandardCharsets.UTF_8));
        String proof=b64(derToRaw(signer.sign()));
        JSONObject packet=new JSONObject().put("actor",owner).put("nonce",nonce)
                .put("ts",ts).put("action",action)
                .put("played_ms",time).put("song_id",songId);
        if("register".equals(action))packet.put("jwk",key);
        return new JSONObject().put("packet",packet).put("signature",proof);
    }
}
