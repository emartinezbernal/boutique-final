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
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', cantidad: 1 });

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // ALTA POR VOLUMEN (NUEVA CELDA DE CANTIDAD)
  async function guardarInventario(e) {
    e.preventDefault();
    const cant = parseInt(nuevoProd.cantidad);
    if (!nuevoProd.nombre || !nuevoProd.precio || cant <= 0) return alert("Datos inválidos");

    // Buscar si ya existe el producto para sumar stock
    const { data: existente } = await supabase
      .from('productos')
      .select('*')
      .eq('nombre', nuevoProd.nombre)
      .eq('precio', parseFloat(nuevoProd.precio))
      .maybeSingle();

    if (existente) {
      await supabase.from('productos')
        .update({ stock: (existente.stock || 0) + cant })
        .eq('id', existente.id);
    } else {
      await supabase.from('productos').insert([{ 
        nombre: nuevoProd.nombre, 
        precio: parseFloat(nuevoProd.precio), 
        stock: cant 
      }]);
    }
    
    // Resetear formulario manteniendo la cantidad por si sigue registrando lotes
    setNuevoProd({ ...nuevoProd, nombre: '' });
    obtenerTodo();
    alert(`✅ Registradas ${cant} piezas correctamente`);
  }

  // COBRO Y DESCUENTO DE STOCK
  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    const { error: errorVenta } = await supabase.from('ventas').insert([{ total, detalles }]);
    
    if (!errorVenta) {
      for (const item of carrito) {
        const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        if (data && data.stock > 0) {
          await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
        }
      }
      setCarrito([]);
      obtenerTodo();
      setVista('historial');
      alert("💰 Venta finalizada. Stock actualizado.");
    }
  }

  const ventasHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === new Date().toLocaleDateString());
  const totalHoy = ventasHoy.reduce((a, b) => a + b.total, 0);

  const btnClass = "boton-interactivo";

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      
      <style>{`
        .boton-interactivo { transition: transform 0.1s; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; user-select: none; }
        .boton-interactivo:active { transform: scale(0.95); filter: brightness(0.9); }
        .badge-carrito { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; }
        .card { background: white; padding: 15px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        input { font-size: 16px; }
      `}</style>

      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v8.5</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: ALTA POR VOLUMEN */}
        {vista === 'admin' && (
          <div className="card">
            <h2 style={{ textAlign: 'center', fontSize: '16px', marginBottom: '15px' }}>➕ Registro de Mercancía</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} className={btnClass} style={{ padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold' }}>${m}</button>
              ))}
            </div>

            <form onSubmit={guardarInventario}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                {['Playera', 'Pantalón', 'Short', 'Sudadera', 'Vestido', 'Blusa', 'Accesorio'].map(t => (
                  <button key={t} type="button" onClick={()=>setNuevoProd({...nuevoProd, nombre: t})} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#fff', whiteSpace: 'nowrap', fontSize: '13px' }}>{t}</button>
                ))}
              </div>

              <label style={{fontSize:'12px', color:'#64748b'}}>Nombre de Prenda</label>
              <input type="text" placeholder="Ej: Jeans Levis" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} />
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{fontSize:'12px', color:'#64748b'}}>Precio unitario ($)</label>
                  <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{fontSize:'12px', color:'#64748b'}}>Cantidad (Volumen)</label>
                  <input type="number" placeholder="Cant." value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} />
                </div>
              </div>

              <button type="submit" className={btnClass} style={{ width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', borderRadius: '15px', fontWeight: 'bold' }}>GUARDAR LOTE</button>
            </form>
          </div>
        )}

        {/* VISTA: CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar en stock..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario
                .filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                .map(p => (
                <div key={p.id} className="card" style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{p.nombre}</p>
                  <p style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>Disponibles: {p.stock}</p>
                  <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '22px', margin: '5px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} className={btnClass} style={{ width: '100%', padding: '10px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '10px', fontWeight: 'bold' }}>+ VENDER</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: CAJA / CARRITO */}
        {vista === 'pos' && (
          <div>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '30px', borderRadius: '25px', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{margin:0, opacity:0.7}}>TOTAL A PAGAR</p>
              <h2 style={{ fontSize: '45px', margin: 0 }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, index) => (
              <div key={index} className="card" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems:'center' }}>
                <span>{item.nombre} - <b>${item.precio}</b></span>
                <button onClick={() => { const c = [...carrito]; c.splice(index,1); setCarrito(c); }} style={{ color:'#ef4444', border:'none', background:'none', fontWeight:'bold' }}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} className={btnClass} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: '#fff', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px', marginTop:'15px' }}>CONFIRMAR PAGO ✅</button>
            )}
          </div>
        )}

        {/* VISTA: REPORTES DIARIOS */}
        {vista === 'historial' && (
          <div>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>CORTE DEL DÍA</p>
              <h2 style={{ fontSize: '38px', margin: 0 }}>${totalHoy}</h2>
              <p style={{ margin: 0 }}>{ventasHoy.length} ventas</p>
            </div>
            {ventasHoy.map(v => (
              <div key={v.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', padding: '12px' }}>
                <span style={{fontSize:'13px', maxWidth:'75%'}}>{v.detalles}</span>
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
