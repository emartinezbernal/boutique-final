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
  
  // REFERENCIA CLAVE PARA CARGA TURBO
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // --- LÓGICA DE GANANCIAS ---
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

  // --- FUNCIÓN CARGA TURBO (REGISTRO SIN MOUSE) ---
  async function guardarTurbo(e) {
    if(e) e.preventDefault();
    const cant = parseInt(nuevoProd.cantidad);
    const costo = parseFloat(nuevoProd.costo) || 0;
    const precio = parseFloat(nuevoProd.precio) || 0;

    if (!nuevoProd.nombre || precio <= 0) return;
    if (precio <= costo && !window.confirm("⚠️ ¿Registrar sin margen de ganancia?")) return;

    const { data: ex } = await supabase.from('productos').select('*').eq('nombre', nuevoProd.nombre).eq('precio', precio).maybeSingle();

    if (ex) {
      await supabase.from('productos').update({ stock: (ex.stock || 0) + cant, costo_unitario: costo }).eq('id', ex.id);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio, costo_unitario: costo, stock: cant }]);
    }

    // RESET TURBO: Limpia y devuelve el foco al teclado
    setNuevoProd({ nombre: '', precio: '', costo: '', cantidad: 1 });
    obtenerTodo();
    setTimeout(() => {
      if(inputNombreRef.current) inputNombreRef.current.focus();
    }, 100);
  }

  // --- TICKET WHATSAPP ---
  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    const ticket = `*🛍️ TICKET - PACA PRO*\n_${new Date().toLocaleString()}_\n--------------------------\n` + 
      carrito.map(item => `• ${item.nombre}: $${item.precio}`).join('\n') + 
      `\n--------------------------\n*TOTAL: $${total}*\n\n¡Gracias por tu compra! ✨`;

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        if (data && data.stock > 0) await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
      }
      if (window.confirm("✅ Venta exitosa. ¿Copiar ticket para WhatsApp?")) {
        navigator.clipboard.writeText(ticket);
      }
      setCarrito([]); obtenerTodo(); setVista('historial');
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '90px' }}>
      <header style={{ backgroundColor: '#0f172a', padding: '15px', textAlign: 'center', borderBottom: '3px solid #10b981', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color:'#10b981'}}>v10.8 TURBO</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* CARGA TURBO (MODO RAYO) */}
        {vista === 'admin' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '16px', textAlign: 'center', marginBottom: '15px', color: '#1e293b' }}>⚡ Registro de Paca (Modo Turbo)</h2>
            <form onSubmit={guardarTurbo}>
              <label style={{fontSize: '11px', color: '#64748b'}}>Nombre de la prenda</label>
              <input ref={inputNombreRef} type="text" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Costo $</label>
                  <input type="number" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing:'border-box' }} required />
                </div>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Venta $</label>
                  <input type="number" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing:'border-box' }} required />
                </div>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Cant.</label>
                  <input type="number" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing:'border-box' }} required />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor:'pointer' }}>GUARDAR Y SIGUIENTE ⚡</button>
            </form>
          </div>
        )}

        {/* REPORTE DE GANANCIAS */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              {['hoy', 'ayer', 'semana'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : '#fff', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ background: '#fff', padding: '25px', borderRadius: '25px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>UTILIDAD NETA ({filtroFecha})</p>
              <h2 style={{ fontSize: '45px', margin: '5px 0', color: '#10b981' }}>${gananciaNeta}</h2>
              <p style={{ margin: 0 }}>Venta: <b>${totalVendido}</b> | Inversión: <b style={{color:'#ef4444'}}>${totalCosto}</b></p>
            </div>
          </div>
        )}

        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar en inventario..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #cbd5e1', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ background: 'white', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{p.nombre}</p>
                  <p style={{ color: '#0f172a', fontSize: '24px', fontWeight: '900', margin: '8px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>VENDER</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARRITO Y COBRO */}
        {vista === 'pos' && (
          <div>
            <div style={{ background: '#0f172a', color: '#fff', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '45px', margin: 0, color: '#10b981' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ background: 'white', padding: '15px', marginBottom: '8px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', borderLeft: (item.precio <= item.costo_unitario) ? '6px solid #ef4444' : '6px solid #10b981' }}>
                <div>
                  <p style={{margin:0, fontWeight:'bold'}}>{item.nombre}</p>
                  <p style={{margin:0, fontSize:'11px', color:'#64748b'}}>Margen: ${(item.precio - item.costo_unitario).toFixed(2)}</p>
                </div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{color:'#ef4444', border:'none', background:'none', fontSize:'22px'}}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px', marginTop: '10px' }}>COBRAR ✅</button>}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: 'white', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background:'none', fontSize:'26px' }}>🛒</button>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background:'none', fontSize:'26px' }}>📦</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background:'none', fontSize:'26px' }}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background:'none', fontSize:'26px' }}>📈</button>
      </nav>
    </div>
  );
}
