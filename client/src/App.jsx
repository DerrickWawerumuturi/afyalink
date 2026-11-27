import { useEffect, useState } from 'react';
import PatientApp from './patient/PatientApp.jsx';
import ProviderDashboard from './provider/ProviderDashboard.jsx';
export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => { const update = () => setRoute(window.location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  if (route !== '#/provider') return <PatientApp />;
  return <><header><strong>AfyaLink</strong><nav aria-label="Main"><a href="#/">Patient app</a><a href="#/provider">Provider dashboard</a></nav></header><main><p role="note">Hackathon prototype · Synthetic data only</p>{route === '#/provider' ? <ProviderDashboard /> : <PatientApp />}</main></>;
}
