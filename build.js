const { exec } = require('child_process');

// 👇 Replace with your simulator's UDID from earlier
const SIMULATOR_ID = 'C37EA6CC-7D99-4821-9DCB-6C50087D901E';

exec(`titanium build -p ios --device-id ${SIMULATOR_ID}`, (err, stdout, stderr) => {
  if (err) {
    console.error(`❌ Build error: ${err}`);
    return;
  }
  console.log(`🚀 Titanium build started...\n`);
  console.log(stdout);
});