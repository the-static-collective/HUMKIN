package org.abundent.humkinradio;

import java.net.URL;

/**
 * Pure rules for the first on-device HUM loop.
 * HUM here is a nontransferable, local game credit; not the reviewed,
 * server-backed Station Guilds HUM or an external financial asset.
 */
final class HumEconomy {
    private HumEconomy() {}
    private static final int[] MINUTES={10,30,50,80};
    private static final int[] HUM={3,1,1,1};
    static final int MAX_DAILY_LISTEN_HUM=6;

    static int earnedMask(long qualifiedTodayMs) {
        int mask=0;
        for(int i=0;i<MINUTES.length;i++){
            if(qualifiedTodayMs>=MINUTES[i]*60_000L)mask|=1<<i;
        }
        return mask;
    }
    static int newAwards(int previousMask,long qualifiedTodayMs) {
        int reached=earnedMask(qualifiedTodayMs) & ~previousMask;
        int sum=0;
        for(int i=0;i<HUM.length;i++)if((reached&(1<<i))!=0)sum+=HUM[i];
        return sum;
    }
    static int newMask(int previousMask,long qualifiedTodayMs) {
        return (previousMask | earnedMask(qualifiedTodayMs)) & 15;
    }
    static int price(boolean currentSingle) {
        return currentSingle?2:1;
    }
    static String canonicalId(String sourceId){
        if(sourceId==null)return null;
        String canonical=SongReactionId.canonical(sourceId);
        if(canonical!=null)return canonical;
        if(sourceId.matches("album:[a-z0-9]+(?:-[a-z0-9]+)*:[1-9][0-9]{0,2}"))
            return sourceId;
        return null;
    }
    /** Files must originate from one of the station's explicitly public media routes. */
    static boolean approvedAudio(String raw) {
        if(raw==null||raw.length()>900)return false;
        try{
            URL url=new URL(raw);
            if(!"https".equals(url.getProtocol()) || url.getPort()!=-1 ||
                    url.getUserInfo()!=null || url.getQuery()!=null || url.getRef()!=null)return false;
            String host=url.getHost(),path=url.getPath();
            if(path==null||path.contains("..")||path.contains("\\")||
                    !path.toLowerCase(java.util.Locale.ROOT).endsWith(".mp3"))return false;
            if("humkin.abundent.org".equals(host))return true;
            return "kbhqacsdvjsstzyplqij.supabase.co".equals(host) &&
                    path.matches("/storage/v1/object/public/humkin-radio-live/"+
                            "[0-9a-fA-F-]{36}/[0-9a-fA-F]{64}\\.mp3");
        }catch(Exception ignored){return false;}
    }
}
