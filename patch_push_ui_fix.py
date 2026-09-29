import sys

with open("index.html", "r") as f:
    content = f.read()

search = """  // If permission is denied, it definitely shouldn't be ON
  if (permission === 'denied') {
      isEnabled = false;
      localStorage.setItem('pushEnabled', 'false');
  } else if (permission === 'granted' && isEnabled) {
      // If it's granted and localStorage says true, it's ON
      isEnabled = true;
  }"""

replace = """  // If permission is denied, it definitely shouldn't be ON
  if (permission === 'denied') {
      isEnabled = false;
      localStorage.setItem('pushEnabled', 'false');
  } else if (permission === 'granted' && isEnabled) {
      // If it's granted and localStorage says true, it's ON
      isEnabled = true;
  } else if (permission === 'default' && isEnabled) {
      // shouldn't happen but just in case
      isEnabled = false;
      localStorage.setItem('pushEnabled', 'false');
  } else if (isEnabled === false && permission === 'granted' && localStorage.getItem('pushEnabled') !== 'false') {
      // We haven't stored it explicitly false but it's granted? We'll rely on pushEnabled.
  }"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
