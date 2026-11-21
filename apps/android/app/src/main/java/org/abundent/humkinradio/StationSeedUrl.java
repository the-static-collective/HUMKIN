package org.abundent.humkinradio;

/** A song selection is only a suggestion; the live catalog validates it. */
final class StationSeedUrl {
    static final String STUDIO = "https://humkin.abundent.org/fm/signal/";
    private StationSeedUrl() {}
    static String forTrack(String trackId) {
        if(trackId==null || !trackId.matches("[-_A-Za-z0-9]{1,90}"))return STUDIO;
        return STUDIO+"?seed="+trackId;
    }
}
