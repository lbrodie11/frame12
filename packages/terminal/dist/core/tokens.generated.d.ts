/** The @frame12/tokens version these values were derived from. */
export declare const TOKENS_PACKAGE_VERSION = "0.2.0";
/** Paper Light and Flashback Dark colors (`paper` is `sheet`). */
export declare const tokenPalette: {
    readonly light: {
        readonly desk: "#e2e3e5";
        readonly sheet: "#ffffff";
        readonly panel: "#ffffff";
        readonly paper: "#ffffff";
        readonly ink: "#121212";
        readonly "ink-2": "#4b4b4b";
        readonly rule: "#121212";
        readonly grid: "#e3e3e3";
        readonly marker: "#ffd60a";
        readonly "marker-ink": "#121212";
    };
    readonly dark: {
        readonly desk: "#000000";
        readonly sheet: "#050505";
        readonly panel: "#19191a";
        readonly paper: "#050505";
        readonly ink: "#f1f0ea";
        readonly "ink-2": "#b9b8b1";
        readonly rule: "#f1f0ea";
        readonly grid: "#2c2c2d";
        readonly marker: "#ffd60a";
        readonly "marker-ink": "#121212";
    };
};
/** Legal gutters in CSS pixels. */
export declare const tokenGutterPx: {
    readonly pair: 12;
    readonly scene: 20;
    readonly change: 32;
};
/** 12 fps "on twos" motion. */
export declare const tokenMotion: {
    readonly fps: 12;
    readonly pose: "83.33ms";
};
