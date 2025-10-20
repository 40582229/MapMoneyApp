import './App.css';
//import MapView from './components/MapView/MapView';
import Map from './components/MapViewGl/MapViewGl';

function App() {
  // register-sw.ts (run once at app startup)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service worker registered for tiles:', reg);
      })
      .catch((err) => console.error('SW registration failed:', err));
  }

  return <Map></Map>;
}

export default App;
