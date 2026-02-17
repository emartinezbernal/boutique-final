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
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // ALTA RÁPIDA CON AGRUPACIÓN
  async function guardarRapido(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena nombre y precio");

    const { data: existente } = await supabase
      .from('productos')
      .select('*')
      .eq('nombre', nuevoProd.nombre)
      .eq('precio', parseFloat(nuevoProd.precio))
      .maybeSingle();

    if (existente) {
      await supabase.from('productos').update({ stock: (existente.stock || 0) + 1 }).eq('id', existente.id);
    } else {
      await supabase.from('productos').insert([{ 
        nombre: nuevoProd.nombre, 
        precio: parseFloat(nuevoProd.precio), 
        codigo_barras: nuevoProd.codigo,
        stock: 1 
      }]);
    }
    setNuevoProd(prev => ({ ...prev, nombre: '', codigo: '' }));
    obtenerTodo();
    alert("✅ Agregado al inventario");
  }

  // VENTA CON DESCUENTO DE STOCK
  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    await supabase.from('ventas').insert([{ total, detalles }]);

    for (const item de carrito) {
      const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
      if (data && data.stock > 0) {
        await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
      }
    }

    setCarrito([]);
    obtenerTodo();
    setVista('historial');
    alert("💰 Venta Exitosa!");
  }

  const ventasHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === new Date().toLocaleDateString());
  const totalHoy = ventasHoy.reduce((a, b) => a + b.total, 0);

  const btnClass = "boton-interactivo";

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      
      <style>{`
        .boton-interactivo { transition: transform 0.1s; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; user-select: none; }
        .boton-interactivo:active { transform: scale(0.92); filter: brightness(0.8); }
        .badge-carrito { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; }
        .card { background: white; padding: 15px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      `}</style>

      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v8.0 FINAL</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: REGISTRO ACELERADO */}
        {vista === 'admin' && (
          <div className="card">
            <h2 style={{ textAlign: 'center', fontSize: '16px', margin: '0 0 15px 0' }}>➕ Alta de Mercancía</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} className={btnClass} style={{ padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold' }}>${m}</button>
              ))}
            </div>
            <form onSubmit={guardarRapido}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                {['Playera', 'Pantalón', 'Short', 'Sudadera', 'Vestido', 'Blusa', 'Accesorio'].map(t => (
                  <button key={t} type="button" onClick={()=>setNuevoProd({...nuevoProd, nombre: t})} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#fff', whiteSpace: 'nowrap', fontSize: '13px' }}>{t}</button>
                ))}
              </div>
              <input type="text" placeholder="Descripción (Ej. Levis Azul)" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input type="number" placeholder="Precio $" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" className={btnClass} style={{ width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px' }}>GUARDAR EN INVENTARIO</button>
            </form>
          </div>
        )}

        {/* VISTA: CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} className="card" style={{ textAlign: 'center', opacity: p.stock <= 0 ? 0.6 : 1 }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{p.nombre}</p>
                  <p style={{ fontSize: '11px', color: p.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>Stock: {p.stock || 0}</p>
                  <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '22px', margin: '5px 0' }}>${p.precio}</p>
                  <button disabled={p.stock <= 0} onClick={()=>setCarrito([...carrito, p])} className={btnClass} style={{ width: '100%', padding: '10px', backgroundColor: p.stock <= 0 ? '#f1f5f9' : '#eff6ff', color: '#2563eb', borderRadius: '10px', fontWeight: 'bold' }}>
                    {p.stock <= 0 ? 'AGOTADO' : '+ AÑADIR'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: CARRITO DETALLADO */}
        {vista === 'pos' && (
          <div>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '30px', borderRadius: '25px', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{margin:0, opacity:0.7, fontSize:'14px'}}>TOTAL A COBRAR</p>
              <h2 style={{ fontSize: '50px', margin: 0, fontWeight: '900' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, index) => (
              <div key={index} className="card" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '5px solid #2563eb' }}>
                <span>{item.nombre} - <b>${item.precio}</b></span>
                <button onClick={() => { const c = [...carrito]; c.splice(index,1); setCarrito(c); }} style={{ color:'#ef4444', border:'none', background:'none', fontWeight:'bold' }}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} className={btnClass} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: '#fff', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px', marginTop: '10px' }}>FINALIZAR VENTA ✅</button>
            )}
          </div>
        )}

        {/* VISTA: REPORTES */}
        {vista === 'historial' && (
          <div>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>VENTAS DE HOY</p>
              <h2 style={{ fontSize: '40px', margin: 0, fontWeight: '900' }}>${totalHoy}</h2>
              <p style={{ margin: 0 }}>{ventasHoy.length} tickets cerrados</p>
            </div>
            <h3 style={{fontSize:'14px', color:'#64748b'}}>Últimos tickets:</h3>
            {ventasHoy.map(v => (
              <div key={v.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', padding: '12px' }}>
                <span style={{fontSize:'13px', maxWidth:'70%'}}>{v.detalles}</span>
                <span style={{fontWeight:'bold'}}>${v.total}</span>
              </div>
            ))}
          </div>
        )}
      </main>

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
