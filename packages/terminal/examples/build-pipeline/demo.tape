# VHS tape (https://github.com/charmbracelet/vhs) for the build-pipeline reference app.
# Run from packages/terminal: vhs examples/build-pipeline/demo.tape
Output examples/build-pipeline/demo.gif
Set Shell "bash"
Set FontSize 15
Set Width 1280
Set Height 760
Set TypingSpeed 40ms
Env FRAME12_MOTION "twos"

Type "node examples/build-pipeline/app.mjs"
Enter
Sleep 3s
Type "node examples/build-pipeline/app.mjs --break test"
Enter
Sleep 4s
