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

  async function guardarRapido(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Faltan datos");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    if (!error) {
      setNuevoProd(prev => ({ ...prev, nombre: '', codigo: '' }));
      obtenerTodo();
      alert("✅ Producto Guardado");
    }
  }

  // NUEVA FUNCIÓN: Eliminar un solo item por su posición en la lista
  const eliminarDelCarrito = (index) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito.splice(index, 1);
    setCarrito(nuevoCarrito);
  };

  const inventarioFiltrado = inventario.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(busqueda))
  );

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
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v6.2</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA REGISTRO */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '15px' }}>➕ Alta de Prenda</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} className={btnClass} style={{ padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold' }}>${m}</button>
              ))}
            </div>
            <form onSubmit={guardarRapido}>
              <input type="text" placeholder="Código de barras..." value={nuevoProd.codigo} onChange={e=>setNuevoProd({...nuevoProd, codigo: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Nombre (Ej. Jeans Levis 32)" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" className={btnClass} style={{ width: '100%', padding: '20px', backgroundColor: '#2563eb', color: 'white', borderRadius: '18px', fontWeight: 'bold', fontSize: '18px' }}>GUARDAR PRENDA</button>
            </form>
          </div>
        )}

        {/* VISTA INVENTARIO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventarioFiltrado.map(p => (
                <div key={p.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <p style={{ fontWeight: '700', margin: '0 0 5px 0' }}>{p.nombre}</p>
                  <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '22px', margin: '0 0 10px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} className={btnClass} style={{ width: '100%', padding: '10px', backgroundColor: '#10b981', color: 'white', borderRadius: '10px', fontWeight: 'bold' }}>
                    + VENDER {carrito.filter(i=>i.id===p.id).length > 0 && `(${carrito.filter(i=>i.id===p.id).length})`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA CARRITO DETALLADA */}
        {vista === 'pos' && (
          <div>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '30px 20px', borderRadius: '30px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{opacity: 0.7, fontSize: '14px'}}>TOTAL DE VENTA</p>
              <h2 style={{ fontSize: '50px', margin: 0, fontWeight: '900' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', color: '#64748b', fontSize: '14px', marginBottom: '10px' }}>PRODUCTOS EN TICKET:</p>
              {carrito.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>El carrito está vacío</div>
              ) : (
                carrito.map((item, index) => (
                  <div key={index} className="card-ticket">
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.nombre}</div>
                      <div style={{ color: '#2563eb', fontWeight: 'bold' }}>${item.precio}</div>
                    </div>
                    <button onClick={() => eliminarDelCarrito(index)} className={btnClass} style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                      Quitar
                    </button>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <button onClick={async ()=>{
                  const total = carrito.reduce((a,b)=>a+b.precio, 0);
                  const detalles = carrito.map(p=>p.nombre).join(', ');
                  await supabase.from('ventas').insert([{ total, detalles }]);
                  await supabase.from('productos').delete().in('id', carrito.map(p=>p.id));
                  setCarrito([]); obtenerTodo(); setVista('historial');
                  alert("💰 ¡Venta completada!");
              }} className={btnClass} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: '#fff', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px' }}>
                COBRAR AHORA ✅
              </button>
            )}
            
            {carrito.length > 0 && (
              <button onClick={()=>setCarrito([])} style={{ width: '100%', marginTop:'20px', color:'#94a3b8', border:'none', background:'none' }}>
                Cancelar y vaciar carrito
              </button>
            )}
          </div>
        )}

        {/* VISTA HISTORIAL */}
        {vista === 'historial' && (
          <div>
            <h3 style={{marginBottom: '15px'}}>Ventas de hoy</h3>
            {historial.map(v => (
              <div key={v.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{flex: 1, paddingRight: '10px'}}>
                  <div style={{fontSize:'14px', fontWeight: 'bold'}}>{v.detalles}</div>
                  <div style={{fontSize:'11px', color: '#94a3b8'}}>{new Date(v.created_at).toLocaleTimeString()}</div>
                </div>
                <span style={{fontWeight:'900', color: '#1e293b', fontSize: '18px'}}>${v.total}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MENÚ INFERIOR */}
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
