
var win = Ti.UI.createWindow({
  backgroundColor: '#1e1e1e',
  layout: 'vertical',
  exitOnClose: true,
  fullscreen: true
});

win.open();

var displayWrapper = Ti.UI.createView({
  backgroundColor: '#333',
  height: '20%',
  width: '100%',
  top: 0,
  padding: 10
});


var displayLabel = Ti.UI.createLabel({
  text: '',
  color: '#fff',
  font: { fontSize: 36, fontWeight: 'bold' },
  textAlign: 'right',
  right: 20,
  width: Ti.UI.FILL,
  height: Ti.UI.FILL,
  verticalAlign: Ti.UI.TEXT_VERTICAL_ALGINMENT_CENTER 
});

displayWrapper.add(displayLabel);
win.add(displayWrapper);


var buttonGrid = Ti.UI.createView({
  layout: 'vertical',
  width: '100%',
  height: '80%',
  bottom: 0,
  backgroundColor: '#000'
});


var buttons = [           
  ['C', '±', '%', '/'],  
  ['7', '8', '9', '*'],  
  ['4', '5', '6', '-'],   
  ['1', '2', '3', '+'],   
  ['0', '.', '=', ]      
];

var currentInput = '';


buttons.forEach(function (row) {
  var rowView = Ti.UI.createView({
    layout: 'horizontal',
    height: '20%',
    width: '100%'
  });

  row.forEach(function (label) {
    var button = Ti.UI.createButton({
      title: label,
      width: label == '0' ? '50%' : '25%',
      height: Ti.UI.FILL,
      font: { fontSize: 24 },
      color: '#fff',
      backgroundColor: '#1e1e1e',
      borderColor: '#333',
      borderWidth: 1
    });

    
    button.addEventListener('click', function () {

      
      button.backgroundColor = '#444';
      setTimeout(function () {
        button.backgroundColor = '#1e1e1e';
      }, 100);

      
      if (label === '=') {
        try {
          
          currentInput = eval(currentInput).toString();
        } catch (e) {
          currentInput = 'Error';
        }
      } 
      
      
      else if (label === 'C') {
        currentInput = '';
      } 

      
      else if (label === '±') {
        if (currentInput.startsWith('-')) {
          currentInput = currentInput.substring(1); 
        } else {
          currentInput = '-' + currentInput; 
        }
      }

      
      else {
        currentInput += label;
      }

      
      displayLabel.text = currentInput;
    });

    rowView.add(button);
  });

  buttonGrid.add(rowView);
});

win.add(buttonGrid);