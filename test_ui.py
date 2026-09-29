from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time
import os

os.system("mkdir -p /home/jules/verification/screenshots /home/jules/verification/videos")

options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# we need playwright to take screenshot and video
