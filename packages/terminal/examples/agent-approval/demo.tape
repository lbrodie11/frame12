# VHS tape (https://github.com/charmbracelet/vhs) for the agent-approval reference app.
# Run from packages/terminal: vhs examples/agent-approval/demo.tape
Output examples/agent-approval/demo.gif
Set Shell "bash"
Set FontSize 15
Set Width 1280
Set Height 760
Set TypingSpeed 40ms
Env FRAME12_MOTION "twos"

Type "node examples/agent-approval/app.mjs --timeout 10"
Enter
Sleep 4s
# Read the arguments, not the prose: three fields differ. Deny.
Type "n"
Sleep 2s
Type "node examples/agent-approval/app.mjs --format plain < /dev/null"
Enter
Sleep 3s
