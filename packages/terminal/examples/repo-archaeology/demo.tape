# VHS tape (https://github.com/charmbracelet/vhs) for the repo-archaeology reference app.
# Run from packages/terminal: vhs examples/repo-archaeology/demo.tape
Output examples/repo-archaeology/demo.gif
Set Shell "bash"
Set FontSize 15
Set Width 1280
Set Height 760
Set TypingSpeed 40ms
Env FRAME12_MOTION "twos"

# The committed hono fixture, so the tape is the same everywhere. For a live run, install
# repo-archaeology@0.10.0 and use --repo <hono clone> --base 61f7c59~6 --head 61f7c59.
Type "node examples/repo-archaeology/app.mjs --fixture"
Enter
Sleep 4s
Type "node examples/repo-archaeology/app.mjs --fixture --format plain | head -20"
Enter
Sleep 3s
