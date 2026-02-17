import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const btnStyle = { transition: 'all 0.1s ease', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' };
const activeEffect = "this.style.transform='scale(0.94)'; this.style.filter='brightness(0.9)'";
const normalEffect = "this.style.transform='scale(1)'; this.style.filter='brightness(1)'";

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

  async function guardarRapido(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena nombre y precio");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    if (!error) {
      setNuevoProd(prev => ({ ...prev, nombre: '', codigo: '' }));
      obtenerTodo();
      alert("✅ Guardado");
    }
  }

  const inventarioFiltrado = inventario.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(busqueda))
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v6.0-ESTABLE</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {vista === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '15px' }}>🚀 Carga Rápida</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} style={{ ...btnStyle, padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold' }}>${m}</button>
              ))}
            </div>

            <form onSubmit={guardarRapido}>
              <input type="text" placeholder="Código de barras..." value={nuevoProd.codigo} onChange={e=>setNuevoProd({...nuevoProd, codigo: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              <input type="text" placeholder="Prenda (Ej. Pantalón)" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" onPointerDown={(e)=>eval(activeEffect)} onPointerUp={(e)=>eval(normalEffect)} style={{ ...btnStyle, width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', borderRadius: '18px', fontWeight: 'bold', fontSize: '18px' }}>GUARDAR ➔</button>
            </form>
          </div>
        )}

        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioFiltrado.map(p => (
                <div key={p.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold' }}>{p.nombre}</p>
                  <p style={{ color: '#2563eb', fontWeight: '900' }}>${p.precio}</p>
                  <button onPointerDown={(e)=>eval(activeEffect)} onPointerUp={(e)=>eval(normalEffect)} onClick={()=>setCarrito([...carrito, p])} style={{ ...btnStyle, width: '100%', padding: '10px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '10px' }}>+ AÑADIR</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '40px 20px', borderRadius: '30px', marginBottom: '20px' }}>
              <h2>Total: ${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            <button onClick={async ()=>{
                await supabase.from('ventas').insert([{ total: carrito.reduce((a,b)=>a+b.precio, 0), detalles: carrito.map(p=>p.nombre).join(', ') }]);
                await supabase.from('productos').delete().in('id', carrito.map(p=>p.id));
                setCarrito([]); obtenerTodo(); setVista('historial');
            }} style={{ ...btnStyle, width: '100%', padding: '20px', backgroundColor: '#10b981', color: '#fff', borderRadius: '20px', fontWeight: 'bold' }}>COBRAR ✅</button>
          </div>
        )}

        {vista === 'historial' && (
          <div>
            <h3>Ventas</h3>
            {historial.map(v => (
              <div key={v.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.detalles}</span>
                <span style={{fontWeight:'bold'}}>${v.total}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '15px', right: '15px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        {[{v:'pos',i:'🛒'},{v:'catalogo',i:'📦'},{v:'admin',i:'➕'},{v:'historial',i:'📈'}].map(n => (
          <button key={n.v} onClick={()=>setVista(n.v)} style={{ ...btnStyle, fontSize: '24px', padding: '12px 20px', borderRadius: '15px', backgroundColor: vista===n.v ? '#eff6ff' : 'transparent' }}>{n.i}</button>
        ))}
      </nav>
    </div>
  );
}
