package org.abundent.humkinradio;

import androidx.media3.common.MediaItem;

/**
 * Published HUMKIN album covers are packaged straight from the website's
 * canonical cover.jpg files. No old concept/mockup paper art is considered
 * official album artwork. Unpublished/unknown tracks use a neutral receiver
 * symbol rather than falsely borrowing a different album's cover.
 *
 * To publish another album, add its approved cover to drawable-nodpi,
 * then register its canonical name here.
 */
final class AlbumArtwork {
    private AlbumArtwork() {}

    static int forAlbum(String album) {
        if (album == null) return R.drawable.ic_radio;
        if (AlbumCatalog.MUTANT_POP.title.equalsIgnoreCase(album)
                || AlbumCatalog.MUTANT_POP.id.equalsIgnoreCase(album)) {
            return R.drawable.album_mutant_pop;
        }
        if (AlbumCatalog.EVERYWHERE.title.equalsIgnoreCase(album)
                || AlbumCatalog.EVERYWHERE.id.equalsIgnoreCase(album)) {
            return R.drawable.album_everywhere_near_you;
        }
        return R.drawable.ic_radio;
    }

    static int forItem(MediaItem item) {
        if (item == null) return R.drawable.ic_radio;
        String id = item.mediaId;
        if (id.startsWith("album:" + AlbumCatalog.MUTANT_POP.id + ":")
                || id.startsWith("mutant-pop-")) return R.drawable.album_mutant_pop;
        if (id.startsWith("album:" + AlbumCatalog.EVERYWHERE.id + ":")
                || id.startsWith("everywhere-near-you-"))
            return R.drawable.album_everywhere_near_you;
        CharSequence title = item.mediaMetadata.albumTitle;
        return forAlbum(title == null ? null : title.toString());
    }
}
