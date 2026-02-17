import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', codigo: '' });

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // Lógica de Registro Rápido (v6.0)
  async function guardarRapido(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Faltan datos");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    if (!error) {
      setNuevoProd(prev => ({ ...prev, nombre: '', codigo: '' })); // Mantenemos el precio para la siguiente prenda
      obtenerTodo();
    }
  }

  const eliminarDelCarrito = (index) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito.splice(index, 1);
    setCarrito(nuevoCarrito);
  };

  // Lógica de Reportes Diarios (v7.0)
  const ventasHoy = historial.filter(v => {
    const hoy = new Date().toLocaleDateString();
    const fechaVenta = new Date(v.created_at).toLocaleDateString();
    return hoy === fechaVenta;
  });
  const totalDineroHoy = ventasHoy.reduce((a, b) => a + b.total, 0);
  const ticketPromedio = ventasHoy.length > 0 ? (totalDineroHoy / ventasHoy.length).toFixed(2) : 0;

  const btnClass = "boton-interactivo";

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      
      <style>{`
        .boton-interactivo { transition: transform 0.1s, filter 0.1s; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; user-select: none; }
        .boton-interactivo:active { transform: scale(0.92); filter: brightness(0.8); }
        .badge-carrito { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; }
        .card-ticket { background: white; padding: 12px; border-radius: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #2563eb; }
      `}</style>

      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v7.1</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: REGISTRO ACELERADO (RESTAURADA) */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '15px' }}>🚀 Carga de Paca</h2>
            
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>Precio rápido:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} className={btnClass} style={{ padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold', fontSize: '13px' }}>${m}</button>
              ))}
            </div>

            <form onSubmit={guardarRapido}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                {['Playera', 'Pantalón', 'Short', 'Sudadera', 'Vestido', 'Blusa'].map(t => (
                  <button key={t} type="button" onClick={()=>setNuevoProd({...nuevoProd, nombre: t})} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#fff', whiteSpace: 'nowrap', fontSize: '13px' }}>{t}</button>
                ))}
              </div>
              <input type="text" placeholder="Código de barras (opcional)..." value={nuevoProd.codigo} onChange={e=>setNuevoProd({...nuevoProd, codigo: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} />
              <input type="text" placeholder="Descripción de prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input type="number" placeholder="Precio $" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" className={btnClass} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', borderRadius: '18px', fontWeight: 'bold', fontSize: '18px' }}>GUARDAR Y SIGUIENTE ➔</button>
            </form>
          </div>
        )}

        {/* VISTA: INVENTARIO CON BUSCADOR */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(busqueda))).map(p => (
                <div key={p.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <p style={{ fontWeight: '700', margin: '0 0 5px 0' }}>{p.nombre}</p>
                  <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '22px', margin: '0 0 10px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} className={btnClass} style={{ width: '100%', padding: '10px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '10px', fontWeight: 'bold' }}>
                    + AÑADIR {carrito.filter(i=>i.id===p.id).length > 0 && `(${carrito.filter(i=>i.id===p.id).length})`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: CARRITO DETALLADO */}
        {vista === 'pos' && (
          <div>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '30px', borderRadius: '25px', marginBottom: '20px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '48px', margin: 0, fontWeight: '900' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
              <p style={{opacity: 0.7}}>Total a Cobrar</p>
            </div>
            {carrito.map((item, index) => (
              <div key={index} className="card-ticket">
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.nombre}</div>
                  <div style={{ color: '#2563eb', fontWeight: 'bold' }}>${item.precio}</div>
                </div>
                <button onClick={() => eliminarDelCarrito(index)} className={btnClass} style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={async ()=>{
                const total = carrito.reduce((a,b)=>a+b.precio, 0);
                const detalles = carrito.map(p=>p.nombre).join(', ');
                await supabase.from('ventas').insert([{ total, detalles }]);
                await supabase.from('productos').delete().in('id', carrito.map(p=>p.id));
                setCarrito([]); obtenerTodo(); setVista('historial');
              }} className={btnClass} style={{ width:'100%', padding:'20px', backgroundColor:'#10b981', color:'#fff', borderRadius:'20px', fontWeight:'bold', marginTop:'20px', fontSize: '18px' }}>FINALIZAR COBRO ✅</button>
            )}
          </div>
        )}

        {/* VISTA: REPORTES ANALYTICS */}
        {vista === 'historial' && (
          <div>
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>📈 Resumen Diario</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{background:'white', padding:'15px', borderRadius:'15px', textAlign:'center'}}>
                <p style={{fontSize:'12px', color:'#64748b', margin:0}}>Ventas</p>
                <p style={{fontSize:'24px', fontWeight:'900', margin:0}}>{ventasHoy.length}</p>
              </div>
              <div style={{background:'white', padding:'15px', borderRadius:'15px', textAlign:'center'}}>
                <p style={{fontSize:'12px', color:'#64748b', margin:0}}>Ticket Prom.</p>
                <p style={{fontSize:'24px', fontWeight:'900', margin:0}}>${ticketPromedio}</p>
              </div>
            </div>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '25px' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>TOTAL DEL DÍA</p>
              <h2 style={{ fontSize: '40px', margin: 0, fontWeight: '900' }}>${totalDineroHoy}</h2>
            </div>
            <h3 style={{ fontSize: '14px', color: '#64748b' }}>Tickets cerrados:</h3>
            {ventasHoy.map(v => (
              <div key={v.id} style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', maxWidth: '70%' }}>{v.detalles}</span>
                <span style={{ fontWeight: 'bold' }}>${v.total}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* NAVEGACIÓN */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '15px', right: '15px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <button onClick={()=>setVista('pos')} className={btnClass} style={{ position: 'relative', fontSize: '24px', padding: '12px', borderRadius: '15px', backgroundColor: vista==='pos' ? '#eff6ff' : 'transparent' }}>
          🛒 {carrito.length > 0 && <span className="badge-carrito">{carrito.length}</span>}
        </button>
        <button onClick={()=>setVista('catalogo')} className={btnClass} style={{ fontSize: '24px', padding: '12px', borderRadius: '15px', backgroundColor: vista==='catalogo' ? '#eff6ff' : 'transparent' }}>📦</button>
        <button onClick={()=>setVista('admin')} className={btnClass} style={{ fontSize: '24px', padding: '12px', borderRadius: '15px', backgroundColor: vista==='admin' ? '#eff6ff' : 'transparent' }}>➕</button>
        <button onClick={()=>setVista('historial')} className={btnClass} style={{ fontSize: '24px', padding: '12px', borderRadius: '15px', backgroundColor: vista==='historial' ? '#eff6ff' : 'transparent' }}>📈</button>
      </nav>
    </div>
  );
}
