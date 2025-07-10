const calculatorScreen = require('./calculator');

const loginScreen = () => {
  const loginWindow = Ti.UI.createWindow({
    backgroundColor: '#222',
    layout: 'vertical',
    exitOnClose: true
  });

  const emailInput = Ti.UI.createTextField({
    hintText: 'Email',
    top: 80,
    width: '80%',
    height: 40,
    borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
    color: '#000000',
    keyboardType: Ti.UI.KEYBOARD_EMAIL
  });

  const passwordInput = Ti.UI.createTextField({
    hintText: 'Password',
    top: 20,
    width: '80%',
    height: 40,
    borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
    color: '#000000'
  });

  const loginButton = Ti.UI.createButton({
    title: 'Login',
    top: 30,
    width: '60%',
    height: 40,
    backgroundColor: '#007aff',
    color: '#fff'
  });

  loginButton.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (email && password) {
      loginWindow.close();
      calculatorScreen(); // go to calculator
    } else {
      alert('Please enter email and password!');
    }
  });

  loginWindow.add(emailInput);
  loginWindow.add(passwordInput);
  loginWindow.add(loginButton);

  loginWindow.open();
};

module.exports = loginScreen;