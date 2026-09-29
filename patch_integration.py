import re

with open('index.html', 'r') as f:
    content = f.read()

# updateTimerUI integration
content = content.replace("""  $('timerNum').textContent = timeLeft;
  if(timeLeft <= 5){
    ring.classList.add('low','pulsing');
    if(navigator.vibrate) navigator.vibrate(60);
  } else {""", """  $('timerNum').textContent = timeLeft;
  if(timeLeft <= 5){
    ring.classList.add('low','pulsing');
    if (timeLeft > 0) {
      playTestSound('warning');
    }
  } else {""")

# selectAnswer integration
content = content.replace("""function selectAnswer(chosen, btnEl){
  clearInterval(timerInterval);
  const q = currentTest[currentIndex];
  if(q.status) return; // already answered
  q.userAnswer = chosen;
  q.status = (chosen === q.correct) ? 'correct' : 'wrong';

  lockOptions(q, btnEl);""", """function selectAnswer(chosen, btnEl){
  playTestSound('tap');
  triggerHaptic('tap');
  clearInterval(timerInterval);
  const q = currentTest[currentIndex];
  if(q.status) return; // already answered
  q.userAnswer = chosen;
  q.status = (chosen === q.correct) ? 'correct' : 'wrong';

  if (q.status === 'correct') {
    playTestSound('correct');
    triggerHaptic('correct');
  } else {
    playTestSound('wrong');
    triggerHaptic('wrong');
  }

  lockOptions(q, btnEl);""")

# handleTimeout integration
content = content.replace("""function handleTimeout(){
  const q = currentTest[currentIndex];
  if(q.status) return;
  q.userAnswer = null;
  q.status = 'timeout';
  lockOptions(q, null);
  if(navigator.vibrate) navigator.vibrate([80,60,80]);
  updateNavButtons();
}""", """function handleTimeout(){
  const q = currentTest[currentIndex];
  if(q.status) return;
  q.userAnswer = null;
  q.status = 'timeout';
  playTestSound('timeout');
  triggerHaptic('timeout');
  lockOptions(q, null);
  updateNavButtons();
}""")

# finishTest integration
content = content.replace("""function finishTest(){
  clearInterval(timerInterval);
  // Any question the user navigated away from without ever answering or
  // timing out counts as "Not Answered" (same scoring bucket as Time Out).
  currentTest.forEach(q=>{
    if(!q.status){
      q.status = 'timeout';
      q.userAnswer = null;
    }
  });""", """function finishTest(){
  playTestSound('finish');
  triggerHaptic('finish');
  clearInterval(timerInterval);
  // Any question the user navigated away from without ever answering or
  // timing out counts as "Not Answered" (same scoring bucket as Time Out).
  currentTest.forEach(q=>{
    if(!q.status){
      q.status = 'timeout';
      q.userAnswer = null;
    }
  });""")


with open('index.html', 'w') as f:
    f.write(content)
