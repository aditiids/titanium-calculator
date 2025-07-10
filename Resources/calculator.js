const calculatorScreen = () => {

  const win = Ti.UI.createWindow({
    backgroundColor: '#1e1e1e',
    fullscreen: true
  });


  const header = Ti.UI.createView({
    top: Ti.Platform.osname === 'iphone' ? 40 : 20,
    height: 60,
    width: Ti.UI.FILL,
    backgroundColor: '#2b2b2b',
    layout: 'horizontal'
    
  });


    const logoutButton = Ti.UI.createButton({
    top: 20,
    title: 'Logout',
    width: 100,
    height: 35,
    backgroundColor: '#cc0000',
    color: '#fff',
    borderRadius: 5,
    center: { x: '50%' }
  });

  logoutButton.addEventListener('click', () => {
    try {
      win.close();
      require('/login')(); 
    } catch (e) {
      Ti.API.error("Logout failed: " + e.message);
    }
  });

  header.add(logoutButton);
  win.add(header); 

  
  const displayWrapper = Ti.UI.createView({
    backgroundColor: '#333',
    height: '20%',
    width: '100%',
    top: header.top + header.height
  });

  const displayLabel = Ti.UI.createLabel({
    text: '',
    color: '#fff',
    font: { fontSize: 36, fontWeight: 'bold' },
    textAlign: 'right',
    right: 20,
    width: Ti.UI.FILL,
    height: Ti.UI.FILL,
    verticalAlign: Ti.UI.TEXT_VERTICAL_ALIGNMENT_CENTER
  });

  displayWrapper.add(displayLabel);
  win.add(displayWrapper); 

  
  const buttonGrid = Ti.UI.createView({
    layout: 'vertical',
    width: '100%',
    height: Ti.UI.FILL,
    top: '30%' 
  });

  const buttons = [
    ['C', '±', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '=', ]
  ];

  let currentInput = '';

  buttons.forEach(row => {
    const rowView = Ti.UI.createView({
      layout: 'horizontal',
      height: '20%',
      width: '100%'
    });

    row.forEach(label => {
      const button = Ti.UI.createButton({
        title: label,
        width: label === '0' ? '50%' : '25%',
        height: Ti.UI.FILL,
        font: { fontSize: 24 },
        color: '#fff',
        backgroundColor: '#1e1e1e',
        borderColor: '#333',
        borderWidth: 1
      });

      button.addEventListener('click', () => {
        button.backgroundColor = '#444';
        setTimeout(() => {
          button.backgroundColor = '#1e1e1e';
        }, 100);

        if (label === '=') {
          try {
            currentInput = eval(currentInput).toString();
          } catch {
            currentInput = 'Error';
          }
        } else if (label === 'C') {
          currentInput = '';
        } else if (label === '±') {
          currentInput = currentInput.startsWith('-') ? currentInput.substring(1) : '-' + currentInput;
        } else {
          currentInput += label;
        }

        displayLabel.text = currentInput;
      });

      rowView.add(button);
    });

    buttonGrid.add(rowView);
  });

  win.add(buttonGrid);
  win.open(); 
};

module.exports = calculatorScreen;