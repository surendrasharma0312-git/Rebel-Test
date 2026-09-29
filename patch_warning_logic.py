import re

with open('index.html', 'r') as f:
    content = f.read()

# Fix warning sound playing every second
content = content.replace("""  if(timeLeft <= 5){
    ring.classList.add('low','pulsing');
    if (timeLeft > 0) {
      playTestSound('warning');
    }
  } else {""", """  if(timeLeft <= 5){
    ring.classList.add('low','pulsing');
    // Only play warning once when it HITS 5 seconds
    if (timeLeft === 5) {
      playTestSound('warning');
    }
  } else {""")

# Fix tap sound and correct/wrong sound overlapping
# We can just remove playTestSound('tap') from selectAnswer, since selecting an answer inherently implies tapping,
# and it plays either correct or wrong immediately. We only play 'tap' if it's some other non-answer button,
# or we can keep it as is. Wait, the feedback said "simultaneous triggering".
content = content.replace("""function selectAnswer(chosen, btnEl){
  playTestSound('tap');
  triggerHaptic('tap');
  clearInterval(timerInterval);""", """function selectAnswer(chosen, btnEl){
  clearInterval(timerInterval);""")

with open('index.html', 'w') as f:
    f.write(content)
