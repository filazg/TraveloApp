import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import './App.css'
import { Route, Routes } from 'react-router-dom'
import WebSalesPage from './pages/webSales/WebSalesPage';
import DownloadPage from './pages/download/DownloadPage';
import { getDataThunk } from './pages/webSalesSlice';

function App() {
  const dispatch = useDispatch();
  const SyncData = async () => {
    console.log('SYNC')
    const data = await dispatch(getDataThunk({ path: "harbors" })).unwrap();
    console.log('SYNC', data)
  };

  useEffect(() => {
    SyncData();
  }, []);


  return (
    <Routes>
      <Route path='/' element={<WebSalesPage/>} />
      <Route path='/download' element={<DownloadPage/>} />
    </Routes>
  )
}

export default App
