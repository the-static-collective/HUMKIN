package org.abundent.humkinradio;

/** Channel positions belong to the in-app HUMKIN dial, never terrestrial spectrum. */
final class VirtualChannels {
    static final float HUMKIN_FREQUENCY=98.2f;
    private VirtualChannels() {}
    static float normalize(float f) {
        if(Float.isNaN(f) || Float.isInfinite(f))return HUMKIN_FREQUENCY;
        return Math.round(Math.max(88f,Math.min(108f,f))*10f)/10f;
    }
    static boolean isPlayable(boolean am,float frequency) {
        return !am&&Math.abs(frequency-HUMKIN_FREQUENCY)<=.55f;
    }
    static String frequencyLabel(float frequency){
        return String.format(java.util.Locale.US,"%.1f",normalize(frequency));
    }
    static String circuitMessage(String circuit,float frequency,boolean archive){
        if("MONO".equals(circuit))return "The MONO/STEREO circuit is still an unbuilt monitor feature. The original recording remains unchanged.";
        if("BOOST".equals(circuit))return "Signal BOOST needs a genuine signal chain, not a fake volume setting. Help build the workshop circuit.";
        if("VOLUME".equals(circuit))return "The physical volume dial is a visual prototype here. Your phone's hardware volume buttons already control the real Media3 player.";
        if("SIGNAL".equals(circuit))return "The signal meter will eventually reflect the true network station state. No imaginary listeners or transmitters.";
        if(archive)return "AM ARCHIVE is not on the air yet. Community collectors can gather rights-cleared historical recordings and build the archive band.";
        return "No HUMKIN transmitter exists yet at "+frequencyLabel(frequency)+
            " virtual FM. The community can build this channel, then it will become a genuine in-app station.";
    }
}
