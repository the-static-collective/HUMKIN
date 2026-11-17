package org.abundent.humkinradio;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;

/**
 * The Android receiver must resolve public media using the authoritative
 * catalog provider. After R2 migration the old Supabase LIVE bucket is empty.
 *
 * No browser-side R2 credentials or remote arbitrary URLs are accepted.
 */
final class RadioSourceUrl {
    private static final String R2_ORIGIN="https://media.abundent.org/";
    private static final String SUPABASE_LIVE=
            "https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/";
    private static final String LEGACY="[0-9a-fA-F-]{36}/[0-9a-fA-F]{64}\\.mp3";
    private static final String R2_TRACK="tracks/[0-9a-fA-F-]{36}/[0-9a-fA-F]{64}\\.mp3";

    private RadioSourceUrl(){}

    static String published(String provider, String legacyPath, String r2Key) {
        if("r2".equals(provider)) {
            // Never fall back to a deleted Supabase copy when R2 is authoritative.
            return r2Key!=null&&r2Key.matches(R2_TRACK)?R2_ORIGIN+r2Key:null;
        }
        if(!"supabase".equals(provider)&&provider!=null&&!provider.isEmpty())return null;
        return legacyPath!=null&&legacyPath.matches(LEGACY)
                ?SUPABASE_LIVE+legacyPath:null;
    }

    /**
     * Catalog-only R2 recordings (such as Blue At The Tip) use a reviewed
     * manifest. Encode each key segment; never accept outside URLs or traversal.
     */
    static String approvedManifestObject(String objectKey) {
        if(objectKey==null || objectKey.length()>400 || !objectKey.equals(objectKey.trim())
                || !objectKey.startsWith("tracks/") || !objectKey.endsWith(".mp3"))return null;
        String[] segments=objectKey.split("/",-1);
        if(segments.length<2 || segments.length>8)return null;
        StringBuilder url=new StringBuilder(R2_ORIGIN);
        for(int i=0;i<segments.length;i++) {
            String segment=segments[i];
            if(segment.isEmpty() || ".".equals(segment) || "..".equals(segment)
                    || segment.contains("\\") || segment.contains("?") || segment.contains("#"))
                return null;
            for(int j=0;j<segment.length();j++){
                char ch=segment.charAt(j);
                if(Character.isISOControl(ch))return null;
            }
            if(i>0)url.append("/");
            try{
                url.append(URLEncoder.encode(segment,"UTF-8").replace("+","%20"));
            }catch(UnsupportedEncodingException ex){return null;}
        }
        return url.toString();
    }
}
