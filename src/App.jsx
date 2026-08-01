import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerOrder from './CustomerOrder'
import InvoiceView from './InvoiceView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerOrder />} />
        <Route path="/invoice/:token" element={<InvoiceView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
