package org.abundent.humkinradio;

import android.content.Context;
import android.animation.ValueAnimator;
import android.os.SystemClock;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.RippleDrawable;
import android.text.Layout;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

final class HumkinVisuals {
    // Match the public station's ink, paper, pink and yellow identity.
    static final int INK = 0xff221b39;
    static final int PLUM = 0xff43375a;
    static final int CREAM = 0xfffff8e9;
    static final int YELLOW = 0xffffdc70;
    static final int MINT = 0xffc6debd;
    static final int PINK = 0xffea9bb3;
    static final int BLUSH = 0xffeedce8;
    static final int WHITE = 0xfffff8ef;

    enum Icon { RADIO, SHUFFLE, PLAY, PAUSE, NEXT, CATCH_UP, ALBUMS, BACK, ARCHIVE, PRIVACY }

    static int dp(Context context, float size) {
        return Math.round(size * context.getResources().getDisplayMetrics().density);
    }

    static GradientDrawable shape(Context context, int color, int radius) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(color);
        background.setCornerRadius(dp(context, radius));
        return background;
    }

    static GradientDrawable panel(Context context, int fill, int edge, int radius) {
        GradientDrawable background = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR, new int[]{fill, edge});
        background.setCornerRadius(dp(context, radius));
        return background;
    }

    static TextView text(Context context, String value, int size, int color, boolean bold) {
        TextView label = new TextView(context);
        label.setText(value);
        label.setTextSize(size);
        label.setTextColor(color);
        label.setGravity(Gravity.CENTER);
        label.setTypeface(Typeface.create(bold ? "sans-serif-black" : "sans-serif", Typeface.NORMAL));
        label.setIncludeFontPadding(false);
        return label;
    }

    static void italic(TextView label) {
        label.setTypeface(Typeface.create("sans-serif", Typeface.ITALIC));
    }

    static Button pill(Context context, String title, Icon icon, int fill, int size, boolean outline) {
        Button button = new PillButton(context);
        button.setText(title);
        button.setAllCaps(false);
        button.setTextColor(INK);
        button.setTextSize(size);
        button.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        button.setLetterSpacing(0.015f);
        button.setIncludeFontPadding(false);
        button.setMinHeight(dp(context, 48));
        button.setMinimumHeight(dp(context, 48));
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setStateListAnimator(null);
        button.setBackgroundTintList(null);
        button.setGravity(Gravity.CENTER);
        setPillFill(button, fill, outline);
        setIcon(button, icon, size >= 20 ? size + 5 : size + 4);
        return button;
    }

    static void setPillFill(Button button, int fill, boolean outline) {
        Context context = button.getContext();
        int highlight;
        int ridge;
        switch (fill) {
            case YELLOW: highlight = 0xffffe281; ridge = 0xffd39d42; break;
            case MINT: highlight = 0xffd6e9ca; ridge = 0xff9fbc9d; break;
            case PINK: highlight = 0xffffc6ce; ridge = 0xffd78595; break;
            default: highlight = CREAM; ridge = CREAM;
        }
        GradientDrawable face = panel(context, highlight, fill, 25);
        Drawable surface = face;
        if (outline) {
            face.setStroke(dp(context, 1.5f), INK);
        } else if (fill != CREAM) {
            face.setStroke(dp(context, 1.2f), INK);
            LayerDrawable layers = new LayerDrawable(new Drawable[]{shape(context, ridge, 25), face});
            layers.setLayerInset(1, 0, 0, 0, dp(context, 3));
            surface = layers;
        }
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x2343102c),
                surface, shape(context, WHITE, 25)));
        ((PillButton) button).padLabel();
        button.setElevation(dp(context, fill == CREAM ? 0 : 2));
    }

    static void setIcon(Button button, Icon icon, int size) {
        if (icon == null) return;
        PillButton pill = (PillButton) button;
        pill.icon = new StationIcon(icon);
        pill.iconSize = dp(button.getContext(), size);
        pill.padLabel();
        pill.invalidate();
    }

    private static final class PillButton extends Button {
        StationIcon icon;
        int iconSize;

        PillButton(Context context) {
            super(context);
        }

        private void padLabel() {
            int reserve = icon == null ? 0 : (iconSize + dp(getContext(), 6) + 1) / 2;
            int side = dp(getContext(), 7) + reserve;
            setPadding(side, dp(getContext(), 7), side, dp(getContext(), 10));
        }

        @Override protected void onDraw(Canvas canvas) {
            Layout label = getLayout();
            if (icon == null || label == null) {
                super.onDraw(canvas);
                return;
            }
            float lineWidth = 0;
            for (int line = 0; line < label.getLineCount(); line++) {
                lineWidth = Math.max(lineWidth, label.getLineWidth(line));
            }
            float offset = (iconSize + dp(getContext(), 6)) / 2f;
            canvas.save();
            canvas.translate(offset, 0);
            super.onDraw(canvas);
            canvas.restore();
            int x = Math.round((getWidth() - lineWidth) / 2f - offset);
            int y = (getHeight() - iconSize + getPaddingTop() - getPaddingBottom()) / 2;
            icon.setBounds(x, y, x + iconSize, y + iconSize);
            icon.draw(canvas);
        }
    }

    static LinearLayout vertical(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);
        return layout;
    }

    static LinearLayout horizontal(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setBaselineAligned(false);
        return layout;
    }

    static LinearLayout.LayoutParams wrap(Context context, int top) {
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(-1, -2);
        layout.topMargin = dp(context, top);
        return layout;
    }

    static LinearLayout.LayoutParams flex(Context context, int left) {
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(0, -2, 1);
        layout.leftMargin = dp(context, left);
        return layout;
    }

    static ImageView art(Context context, int artwork) {
        ImageView image = new ImageView(context);
        image.setImageResource(artwork);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setBackground(shape(context, PLUM, 12));
        image.setClipToOutline(true);
        return image;
    }

    static ImageView illustration(Context context, int resource) {
        ImageView image = new ImageView(context);
        image.setImageResource(resource);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        return image;
    }

    /**
     * A small procedural on-air meter, driven by the actual Media3 playing
     * state. It is NOT the decoded song's frequency spectrum: that would
     * require extra permissions / a separate audio capture path. The meter
     * is deliberately cheap, stops when hidden or paused, and honors Android's
     * reduced-motion setting.
     */
    static HumkinWaveform waveform(Context context) {
        return new HumkinWaveform(context);
    }

    static final class HumkinWaveform extends View {
        private static final int[] HEIGHTS = {
            4, 7, 5, 11, 16, 13, 8, 5, 7, 12, 9, 7, 4,
            6, 10, 15, 18, 13, 9, 5, 7, 11, 14, 9, 7, 4
        };
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private boolean active;
        private boolean visible;
        private long startedMs;

        HumkinWaveform(Context context) {
            super(context);
            setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        }

        void setActive(boolean playing) {
            if (active == playing) return;
            active = playing;
            if (playing) startedMs = SystemClock.uptimeMillis();
            invalidate();
        }

        @Override public void onVisibilityAggregated(boolean isVisible) {
            super.onVisibilityAggregated(isVisible);
            visible = isVisible;
            if (visible) invalidate();
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float step = getWidth() / (float) HEIGHTS.length;
            float center = getHeight() * .5f;
            float available = Math.max(0f, center - dp(getContext(), 1.5f));
            boolean moving = active && visible && ValueAnimator.areAnimatorsEnabled();
            float time = (SystemClock.uptimeMillis() - startedMs) / 1000f;
            paint.setColor(0xffc292a6);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeWidth(step * .40f);
            for (int i = 0; i < HEIGHTS.length; i++) {
                float shape = HEIGHTS[i] / 23f;
                float level = .08f + shape * .84f;
                if (moving) {
                    // Several incommensurate waves produce recognizable but
                    // non-mechanical motion, without reading microphone audio.
                    double drift = .56 * Math.sin(time * 4.1 + i * .63)
                                 + .28 * Math.sin(time * 2.35 - i * .32)
                                 + .16 * Math.sin(time * 6.15 + i * 1.42);
                    float energy = (float) Math.min(1.0, Math.abs(drift) * 1.43);
                    level = .13f + (.20f + .64f * energy)
                                  * (.48f + .52f * shape);
                }
                float x = step * (i + .5f);
                float extension = level * available;
                canvas.drawLine(x, center - extension,
                        x, center + extension, paint);
            }
            // Never spin a draw loop while the receiver is paused, off-screen
            // or the user has disabled system animations.
            if (moving) postInvalidateDelayed(45L);
        }
    }

    private static final class StationIcon extends Drawable {
        private final Icon icon;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        StationIcon(Icon icon) {
            this.icon = icon;
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setStrokeWidth(2);
        }

        @Override public void draw(Canvas canvas) {
            canvas.save();
            canvas.translate(getBounds().left, getBounds().top);
            canvas.scale(getBounds().width() / 24f, getBounds().height() / 24f);
            paint.setColor(INK);
            paint.setStyle(Paint.Style.STROKE);
            path.reset();
            switch (icon) {
                case RADIO:
                    canvas.drawArc(2, 2, 22, 22, 134, 92, false, paint);
                    canvas.drawArc(2, 2, 22, 22, -46, 92, false, paint);
                    canvas.drawArc(6, 6, 18, 18, 132, 96, false, paint);
                    canvas.drawArc(6, 6, 18, 18, -48, 96, false, paint);
                    paint.setStyle(Paint.Style.FILL);
                    canvas.drawCircle(12, 12, 2.2f, paint);
                    break;
                case SHUFFLE:
                    path.moveTo(3, 6); path.cubicTo(11, 6, 11, 18, 18, 18);
                    path.lineTo(21, 18);
                    path.moveTo(3, 18); path.cubicTo(11, 18, 11, 6, 18, 6);
                    path.lineTo(21, 6);
                    path.moveTo(18, 3); path.lineTo(21, 6); path.lineTo(18, 9);
                    path.moveTo(18, 15); path.lineTo(21, 18); path.lineTo(18, 21);
                    break;
                case PLAY:
                case NEXT:
                    paint.setStyle(Paint.Style.FILL);
                    triangle(icon == Icon.PLAY ? 6 : 3, icon == Icon.PLAY ? 18 : 12);
                    if (icon == Icon.NEXT) triangle(12, 21);
                    break;
                case PAUSE:
                    paint.setStyle(Paint.Style.FILL);
                    canvas.drawRoundRect(6, 5, 10, 19, 1, 1, paint);
                    canvas.drawRoundRect(14, 5, 18, 19, 1, 1, paint);
                    break;
                case CATCH_UP:
                    canvas.drawArc(4, 4, 21, 21, 197, 295, false, paint);
                    path.moveTo(2, 9); path.lineTo(4.5f, 13); path.lineTo(8, 10);
                    path.moveTo(12.5f, 8); path.lineTo(12.5f, 13); path.lineTo(16, 15);
                    break;
                case ALBUMS:
                    canvas.drawCircle(15, 12, 7.5f, paint);
                    canvas.drawCircle(15, 12, 2f, paint);
                    canvas.save();
                    canvas.rotate(8, 9, 12);
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(YELLOW);
                    canvas.drawRoundRect(2, 4, 16, 20, 1.5f, 1.5f, paint);
                    paint.setColor(INK);
                    paint.setStyle(Paint.Style.STROKE);
                    canvas.drawRoundRect(2, 4, 16, 20, 1.5f, 1.5f, paint);
                    canvas.drawLine(3, 16, 7, 12, paint);
                    canvas.drawLine(7, 12, 10, 15, paint);
                    canvas.drawLine(10, 15, 15, 11, paint);
                    canvas.restore();
                    break;
                case BACK:
                    path.moveTo(21, 12); path.lineTo(3, 12);
                    path.lineTo(10, 5); path.moveTo(3, 12); path.lineTo(10, 19);
                    break;
                case ARCHIVE:
                    canvas.drawRoundRect(4, 9, 20, 20, 1.5f, 1.5f, paint);
                    canvas.drawRoundRect(6, 4, 18, 9, 1.5f, 1.5f, paint);
                    canvas.drawLine(10, 13, 14, 13, paint);
                    break;
                case PRIVACY:
                    path.moveTo(12, 3); path.quadTo(16, 7, 20, 7);
                    path.quadTo(20, 16, 12, 21);
                    path.quadTo(4, 16, 4, 7); path.quadTo(8, 7, 12, 3);
                    path.moveTo(9, 12); path.lineTo(11, 14); path.lineTo(15, 10);
                    break;
            }
            canvas.drawPath(path, paint);
            canvas.restore();
        }

        private void triangle(float left, float right) {
            path.moveTo(left, 5);
            path.lineTo(right, 12);
            path.lineTo(left, 19);
            path.close();
        }

        @Override public void setAlpha(int alpha) {}
        @Override public void setColorFilter(ColorFilter filter) {}
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }
}
