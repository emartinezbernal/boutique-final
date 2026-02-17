import React, { useState } from 'react';
import { ShoppingCart, List, Package, Trash2 } from 'lucide-react';

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('pos');

  const productosPrueba = [
    { id: 1, nombre: 'Playera Premium', precio: 150 },
    { id: 2, nombre: 'Pantalón Mezclilla', precio: 350 },
    { id: 3, nombre: 'Sudadera', precio: 250 }
  ];

  const agregar = (p) => setCarrito([...carrito, { ...p, idTemp: Date.now() }]);

  return (
    <div className="min-h-screen bg-gray-100 pb-24 font-sans">
      <header className="bg-white p-4 shadow-sm text-center">
        <h1 className="text-xl font-black text-blue-600">PACA PRO v1.0</h1>
      </header>

      <main className="p-4">
        {vista === 'pos' ? (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg">
              <p className="text-xs opacity-70 uppercase font-bold">Total a Cobrar</p>
              <p className="text-5xl font-black">${carrito.reduce((acc, p) => acc + p.precio, 0)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border">
              {carrito.length === 0 ? <p className="text-gray-400 text-center py-4">Carrito vacío</p> : 
                carrito.map((p) => (
                  <div key={p.idTemp} className="flex justify-between border-b py-3 last:border-0">
                    <span className="font-medium">{p.nombre}</span>
                    <span className="font-bold text-blue-600">${p.precio}</span>
                  </div>
                ))
              }
            </div>
            <button onClick={() => {alert('Venta realizada'); setCarrito([])}} className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg active:scale-95 transition">COBRAR</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {productosPrueba.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border text-center">
                <Package className="mx-auto text-blue-200 mb-2" size={32} />
                <p className="font-bold text-sm">{p.nombre}</p>
                <p className="text-blue-600 font-black text-lg">${p.precio}</p>
                <button onClick={() => agregar(p)} className="mt-2 w-full bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold active:bg-blue-600 active:text-white transition">Añadir</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white p-4 flex justify-around border-t shadow-2xl">
        <button onClick={() => setVista('pos')} className={vista === 'pos' ? "text-blue-600" : "text-gray-400"}>
          <ShoppingCart size={24} className="mx-auto"/><span className="text-[10px] font-bold">VENTA</span>
        </button>
        <button onClick={() => setVista('catalogo')} className={vista === 'catalogo' ? "text-blue-600" : "text-gray-400"}>
          <List size={24} className="mx-auto"/><span className="text-[10px] font-bold">CATÁLOGO</span>
        </button>
      </nav>
    </div>
  );
}
