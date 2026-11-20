package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Native HUMKIN Orchard: deliberately local HUM, native Media3 listening only.
 * Browser HUM and native HUM are separate until an opt-in trusted account bridge
 * exists. Local inventory cannot be used to claim globally scarce artifacts.
 */
final class OrchardLedger {
    static final String FILE="humkin-native-orchard-v1";
    static final long HUM_PULSE=18_000L, FIRST_FIND=240_000L, NEXT_FIND=720_000L;

    static final class Spec {
        final String id,name,icon,lore;
        final int price,level;
        final boolean outdoors,rare;
        Spec(String id,String name,String icon,int price,int level,boolean outdoors,String lore,boolean rare){
            this.id=id;this.name=name;this.icon=icon;this.price=price;this.level=level;
            this.outdoors=outdoors;this.lore=lore;this.rare=rare;
        }
    }
    private static Spec spec(String id,String name,String icon,int cost,int level,boolean outdoor,String lore){
        return new Spec(id,name,icon,cost,level,outdoor,lore,false);
    }
    private static Spec rare(String id,String name,String icon,boolean outdoor,String lore){
        return new Spec(id,name,icon,0,1,outdoor,lore,true);
    }
    static final Spec[] SHOP={
        spec("crooked-lamp","Crooked Lamp","💡",18,1,false,"Illuminates one suspicious corner."),
        spec("blue-cup","Chipped Blue Cup","☕",20,1,false,"A cup with a long career in short stories."),
        spec("first-seed","Window Seed","🌱",24,1,true,"Grows toward the sound of the dial."),
        spec("brass-dial","Brass Tuning Dial","📻",32,1,false,"The knob goes to eleven, then asks for directions."),
        spec("moss-rock","Mossy Rock","🪨",28,1,true,"Older than station management."),
        spec("old-record","Unreasonably Round Record","💿",35,1,false,"An argument for circles."),
        spec("tiny-cactus","Tiny Cactus","🌵",38,2,true,"The least welcoming fan."),
        spec("paper-crane","Paper Crane","🕊️",42,2,false,"Made from yesterday's weather."),
        spec("shy-mushroom","Shy Mushroom","🍄",48,2,true,"Taller when nobody watches."),
        spec("cassette-garden","Cassette Planter","🪴",60,2,true,"An old mixtape finally takes root."),
        spec("window-curtain","Theatrical Curtains","🎭",56,2,false,"Opening night, every night."),
        spec("flower-bed","Bloom Bed","🌸",65,3,true,"A suspiciously musical arrangement."),
        spec("ceramic-goose","Ceramic Goose","🪿",74,3,false,"Never approved the playlist."),
        spec("sun-dial","Unreliable Sundial","🕰️",80,3,true,"Accurate twice every noontime."),
        spec("vinyl-shelf","Record Shelf","📚",88,3,false,"The records swear they're alphabetized."),
        spec("second-speaker","Second Speaker","🔊",95,3,false,"Prefers the B sides."),
        spec("wild-rose","Wild Rose","🌹",106,4,true,"Survived a signal outage."),
        spec("antenna","Copper Antenna","📡",118,4,true,"Receives the occasional blessing from geese."),
        spec("old-gramophone","Old Gramophone","📯",130,4,false,"Has played records since before it was made."),
        spec("kettle","Forever Kettle","🫖",144,4,false,"Nobody found the off switch."),
        spec("radio-house","Tiny Radio House","🏠",155,5,true,"Built from useful favors."),
        spec("fruit-tree","Blue Orchard Tree","🌳",170,5,true,"Grows in odd meters."),
        spec("clockwork-bee","Clockwork Bee","🐝",182,5,true,"Unionized immediately."),
        spec("glasshouse","Glasshouse","🏡",200,6,true,"For cultivating peculiar possibilities."),
        spec("tape-machine","Reel Machine","🎞️",225,6,false,"Spools stories nobody recorded."),
        spec("moon-lantern","Moon Lantern","🏮",245,6,true,"Makes darkness a useful shade of blue."),
        spec("observatory","Pocket Observatory","🔭",290,7,true,"Studies the moon's listening habits."),
        spec("organ-pipes","Garden Organ","🎹",320,7,true,"Wind-powered experimental theology."),
        spec("transmitter","Mini Transmitter","📻",360,8,true,"Not a licensed FM transmitter."),
        spec("mystery-orchard","Impossible Orchard","🌲",420,9,true,"The trees disagree about whose orchard this is.")
    };
    static final Spec[] RARE={
        rare("haunted-needle","Haunted Needle","🪡",false,"Refuses to play the same record twice."),
        rare("accidental-squirrel","Ceramic Squirrel","🐿️",true,"Spectacularly useless."),
        rare("midnight-rose","Midnight Rose","🥀",true,"Blooms at the wrong hour."),
        rare("phonograph-moth","Phonograph Moth","🦋",true,"Drawn to warm frequencies."),
        rare("impossible-egg","Improbable Egg","🥚",false,"No ornithologist has explained it."),
        rare("blue-moon","Small Blue Moon","🌙",true,"Arrived with the night shift."),
        rare("broken-compass","Compassionate Compass","🧭",false,"Points toward somebody who needs a hand."),
        rare("golden-apple","Golden Apple of Static","🍏",true,"Nobody remembers planting the tree."),
        rare("merit-spool","Little Engine Spool","🧵",false,"A completed LOCAL manifest check. Not remotely verified.")
    };
    static Spec find(String id){
        if(id==null)return null;
        for(Spec s:SHOP)if(s.id.equals(id))return s;
        for(Spec s:RARE)if(s.id.equals(id))return s;
        return null;
    }
    static final class Snapshot {
        final int hum,level,stage,receipts;
        final long totalMs;
        final Set<String> owned;
        final String[] placed;
        final String hash,workDay;
        Snapshot(int hum,int level,int stage,long totalMs,Set<String> owned,String[] placed,
                 String hash,String workDay,int receipts){
            this.hum=hum;this.level=level;this.stage=stage;this.totalMs=totalMs;
            this.owned=Collections.unmodifiableSet(owned);
            this.placed=placed;this.hash=hash;this.workDay=workDay;this.receipts=receipts;
        }
    }
    private OrchardLedger(){}
    private static SharedPreferences store(Context c){
        return c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE);
    }
    /** Uses the Media3-powered SignalRpg total. No screen-on/wall-clock HUM minting. */
    static synchronized Snapshot snapshot(Context c){
        SharedPreferences p=store(c);
        SignalRpg.Snapshot radio=SignalRpg.snapshot(c);
        settle(p,radio.totalMs);
        Set<String> owned=new HashSet<>(p.getStringSet("owned",Collections.emptySet()));
        String[] places=new String[8];
        for(int i=0;i<8;i++)places[i]=p.getString("place_"+i,"");
        int stage=Math.min(6,Math.max(0,(radio.level-1)/2)+p.getInt("quiet_days",0));
        return new Snapshot(p.getInt("hum",42),radio.level,stage,radio.totalMs,owned,
            places,p.getString("audit_hash",""),p.getString("audit_day",""),
            p.getInt("audit_count",0));
    }
    private static void settle(SharedPreferences p,long totalMs){
        long now=System.currentTimeMillis();
        if(!p.contains("hum")){
            p.edit().putInt("hum",42).putLong("credited_ms",0L)
                .putLong("last_seen",now).putInt("quiet_days",0)
                .putStringSet("owned",new HashSet<>()).apply();
        }
        long prev=Math.max(0L,p.getLong("credited_ms",0L)),current=Math.max(prev,totalMs);
        long earned=Math.max(0L,current/HUM_PULSE-prev/HUM_PULSE);
        int balance=p.getInt("hum",42)+(int)Math.min(100000L,earned);
        balance=Math.min(1000000000,Math.max(0,balance));
        int finds=(int)Math.min(10000L,current<FIRST_FIND?0:1+(current-FIRST_FIND)/NEXT_FIND);
        int oldFinds=p.getInt("finds",0);
        Set<String> owned=new HashSet<>(p.getStringSet("owned",Collections.emptySet()));
        for(int i=oldFinds;i<Math.min(finds,RARE.length-1);i++)owned.add(RARE[i].id);
        // Quiet time grows scenery only. No currency and no listening claims.
        long old=p.getLong("last_seen",now);
        int newQuiet=p.getInt("quiet_days",0);
        if(now>old&&now-old>=24L*3600000L)
            newQuiet+=Math.min(2,(int)((now-old)/(24L*3600000L)));
        p.edit().putInt("hum",balance).putLong("credited_ms",current)
            .putLong("last_seen",now).putInt("quiet_days",Math.min(6,newQuiet))
            .putInt("finds",Math.max(oldFinds,finds)).putStringSet("owned",owned).apply();
    }
    static synchronized boolean buy(Context c,String id){
        Spec object=find(id);
        if(object==null||object.rare)return false;
        Snapshot s=snapshot(c);
        if(s.level<object.level||s.hum<object.price||s.owned.contains(id))return false;
        SharedPreferences p=store(c);
        Set<String> owned=new HashSet<>(s.owned);owned.add(id);
        p.edit().putStringSet("owned",owned).putInt("hum",s.hum-object.price).apply();
        return true;
    }
    static synchronized boolean place(Context c,String id,int slot){
        if(slot<0||slot>7)return false;
        Spec spec=find(id);
        Snapshot s=snapshot(c);
        if(spec==null||!s.owned.contains(id)||spec.outdoors!=(slot>=4))return false;
        SharedPreferences p=store(c);
        SharedPreferences.Editor edit=p.edit();
        for(int i=0;i<8;i++)if(id.equals(s.placed[i]))edit.putString("place_"+i,"");
        edit.putString("place_"+slot,id).apply();
        return true;
    }
    static synchronized void stow(Context c,String id){
        Snapshot s=snapshot(c);
        SharedPreferences.Editor edit=store(c).edit();
        for(int i=0;i<8;i++)if(id.equals(s.placed[i]))edit.putString("place_"+i,"");
        edit.apply();
    }
    /** Caller validates the remote *public* JSON and computes the SHA-256 hash. */
    static synchronized boolean recordLocalAudit(Context c,String hash,int count){
        if(hash==null||!hash.matches("[0-9a-f]{64}")||count<1||count>1000)return false;
        Snapshot s=snapshot(c);
        if(s.level<4)return false;
        SharedPreferences p=store(c);
        String day=SignalRpg.chicagoDay(System.currentTimeMillis());
        if(day.equals(s.workDay))return false;
        Set<String> owned=new HashSet<>(s.owned);owned.add("merit-spool");
        p.edit().putInt("hum",Math.min(1000000000,s.hum+28))
            .putString("audit_day",day).putString("audit_hash",hash)
            .putInt("audit_count",count).putStringSet("owned",owned).apply();
        return true;
    }
}
