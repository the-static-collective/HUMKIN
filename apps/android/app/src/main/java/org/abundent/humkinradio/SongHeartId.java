package org.abundent.humkinradio;

import java.util.Locale;

/** Resolve a playing Media3 item to the public station's canonical track ID.
 * Album playback's private "album:..." ID is NOT the chart catalog ID.
 */
final class SongHeartId {
    private SongHeartId() {}
    static String canonical(String mediaId) {
        if(mediaId==null)return null;
        if(mediaId.startsWith("album:")) {
            String[] parts=mediaId.split(":",-1);
            if(parts.length!=3 || !parts[2].matches("[0-9]{1,3}"))return null;
            int number=Integer.parseInt(parts[2]);
            int max;
            if("mutant-pop".equals(parts[1]))max=12;
            else if("everywhere-near-you".equals(parts[1]))max=7;
            else return null;
            if(number<1 || number>max)return null;
            mediaId=parts[1]+"-"+String.format(Locale.US,"%02d",number);
        }
        // No URLs, arbitrary query parameters, or field-produced station IDs.
        if(!mediaId.matches("[-a-zA-Z0-9]{3,90}"))return null;
        if(mediaId.startsWith("field-fm-") || mediaId.startsWith("bumper-"))return null;
        return mediaId;
    }
}
