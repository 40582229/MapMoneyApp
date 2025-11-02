import { createConnection } from 'net';

const dump1090Host = '127.0.0.1';
const dumnp1090Port = 30003;

const client = createConnection(dumnp1090Port, dump1090Host, () => {
  console.log('CONNECTED TO dump1090');
});

const useFlightDataGet = () => {
  let buffer = '';
  client.on('data', (data) => {
    buffer += data.toString();
    let lines = buffer.split('\n');
    const ln = lines.pop();
    if (ln) buffer = ln;

    lines.forEach((line) => {
      const parts = line.split(',');
      // console.log(parts)
      if (parts[0] === 'MSG' && parts[14] && parts[15]) {
        const json = {
          //type: parts[0],
          //transmissionType: parts[1],
          id: parts[4],
          //flight: parts[10],
          heightMeters: parts[11],
          //speed: parts[13],
          coords:[parts[15], parts[14]],
          sizeMeters:500,
          color: '#32D74B',
          name:'plane'+parts[4]  
          //track: parts[16],
        };
        console.log(json);
        // broadcast JSON to all WebSocket clients
      }
    });
  });
};

export default useFlightDataGet;