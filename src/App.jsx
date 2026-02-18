import React, { useState, useEffect, useRef } from 'react';
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
  const [filtroFecha, setFiltroFecha] = useState('hoy');
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  
  // Referencia para Carga Turbo
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // CÁLCULOS FINANCIEROS
  const ventasFiltradas = historial.filter(v => {
    const fechaVenta = new Date(v.created_at);
    const hoy = new Date();
    if (filtroFecha === 'hoy') return fechaVenta.toLocaleDateString() === hoy.toLocaleDateString();
    if (filtroFecha === 'ayer') {
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      return fechaVenta.toLocaleDateString() === ayer.toLocaleDateString();
    }
    if (filtroFecha === 'semana') {
      const semana = new Date(); semana.setDate(hoy.getDate() - 7);
      return fechaVenta >= semana;
    }
    return true;
  });

  const totalVendido = ventasFiltradas.reduce((a, b) => a + (b.total || 0), 0);
  const totalCosto = ventasFiltradas.reduce((a, b) => a + (b.costo_total || 0), 0);
  const gananciaNeta = totalVendido - totalCosto;

  // CARGA TURBO: REGISTRO RÁPIDO
  async function guardarTurbo(e) {
    if(e) e.preventDefault();
    const cant = parseInt(nuevoProd.cantidad);
    const costo = parseFloat(nuevoProd.costo) || 0;
    const precio = parseFloat(nuevoProd.precio) || 0;

    if (!nuevoProd.nombre || precio <= 0) return;

    if (precio <= costo) {
      if (!confirm("⚠️ Sin ganancia detectada. ¿Registrar de todos modos?")) return;
    }

    const { data: ex } = await supabase.from('productos').select('*').eq('nombre', nuevoProd.nombre).eq('precio', precio).maybeSingle();

    if (ex) {
      await supabase.from('productos').update({ stock: (ex.stock || 0) + cant, costo_unitario: costo }).eq('id', ex.id);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio, costo_unitario: costo, stock: cant }]);
    }

    // Reset Turbo: Limpiar y enfocar
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    if(inputNombreRef.current) inputNombreRef.current.focus();
  }

  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        if (data && data.stock > 0) await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]); obtenerTodo(); setVista('historial');
      alert("✅ Venta realizada");
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '100px' }}>
      
      <header style={{ backgroundColor: '#1e293b', padding: '15px', textAlign: 'center', borderBottom: '3px solid #10b981' }}>
        <h1 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v10.0 TURBO</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA CARGA TURBO */}
        {vista === 'admin' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '16px', textAlign: 'center', marginBottom: '15px', color: '#1e293b' }}>⚡ Carga Rápida de Inventario</h2>
            
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '15px', paddingBottom: '5px' }}>
              {['Playera', 'Jeans', 'Sudadera', 'Short', 'Vestido', 'Chamarra'].map(t => (
                <button key={t} onClick={()=>setNuevoProd({...nuevoProd, nombre: t})} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f1f5f9', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{t}</button>
              ))}
            </div>

            <form onSubmit={guardarTurbo}>
              <label style={{fontSize: '11px', color: '#64748b'}}>Nombre / Descripción</label>
              <input ref={inputNombreRef} type="text" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Costo $</label>
                  <input type="number" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
                </div>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Venta $</label>
                  <input type="number" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
                </div>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Cant.</label>
                  <input type="number" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}>GUARDAR (ENTER)</button>
            </form>
          </div>
        )}

        {/* REPORTE DE GANANCIAS */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              {['hoy', 'ayer', 'semana'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: filtroFecha === f ? '#1e293b' : '#fff', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{f.toUpperCase()}</button>
              ))}
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '25px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>GANANCIA ESTIMADA</p>
              <h2 style={{ fontSize: '42px', margin: '5px 0', color: '#10b981' }}>${gananciaNeta}</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '13px' }}>
                <span>Venta: <b>${totalVendido}</b></span>
                <span>Costo: <b style={{color:'#ef4444'}}>${totalCosto}</b></span>
              </div>
            </div>
          </div>
        )}

        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #cbd5e1', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ background: 'white', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{p.nombre}</p>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>Disponibles: {p.stock}</p>
                  <p style={{ color: '#1e293b', fontSize: '24px', fontWeight: '900', margin: '8px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>+ AÑADIR</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAJA / COBRO */}
        {vista === 'pos' && (
          <div>
            <div style={{ background: '#1e293b', color: '#fff', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '15px' }}>
              <p style={{margin:0, opacity:0.6}}>TOTAL A PAGAR</p>
              <h2 style={{ fontSize: '45px', margin: 0, color: '#10b981' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ background: 'white', padding: '15px', marginBottom: '8px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', borderLeft: (item.precio <= item.costo_unitario) ? '6px solid #ef4444' : '6px solid #10b981' }}>
                <div>
                  <p style={{margin:0, fontWeight:'bold'}}>{item.nombre}</p>
                  <p style={{margin:0, fontSize:'11px', color:'#64748b'}}>Ganancia: ${(item.precio - item.costo_unitario).toFixed(2)}</p>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <span style={{fontWeight:'bold', fontSize: '18px'}}>${item.precio}</span>
                  <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{color:'#ef4444', border:'none', background:'none', fontWeight:'bold', fontSize:'20px'}}>✕</button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px', marginTop: '10px' }}>FINALIZAR VENTA ✅</button>}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '15px', right: '15px', background: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background:'none', fontSize:'26px', position:'relative' }}>🛒 {carrito.length > 0 && <span style={{position:'absolute', top:'-5px', right:'-5px', background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background:'none', fontSize:'26px' }}>📦</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background:'none', fontSize:'26px' }}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background:'none', fontSize:'26px' }}>📈</button>
      </nav>
    </div>
  );
}
