import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [gastos, setGastos] = useState([]);
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
  
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
    const resG = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (resG.data) setGastos(resG.data);
  }

  // --- LÓGICA DE STOCK DINÁMICO ---
  const inventarioReal = useMemo(() => {
    return inventario.map(p => {
      const enCarrito = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: p.stock - enCarrito };
    });
  }, [inventario, carrito]);

  // --- MÉTRICAS ---
  const hoy = new Date().toLocaleDateString();
  const ventasHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === hoy);
  const gastosHoy = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === hoy);

  const totalVendido = ventasHoy.reduce((a, b) => a + (b.total || 0), 0);
  const totalCostoVenta = ventasHoy.reduce((a, b) => a + (b.costo_total || 0), 0);
  const totalGastos = gastosHoy.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const utilidadNeta = totalVendido - totalCostoVenta - totalGastos;

  // --- ACCIÓN CRÍTICA: FINALIZAR VENTA ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;

    try {
      const total = carrito.reduce((a, b) => a + b.precio, 0);
      const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
      const detalles = carrito.map(i => i.nombre).join(', ');

      // 1. Registrar la venta en Supabase
      const { error: errorVenta } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
      if (errorVenta) throw errorVenta;

      // 2. Descontar stock pieza por pieza
      const conteo = carrito.reduce((acc, p) => { acc[p.id] = (acc[p.id] || 0) + 1; return acc; }, {});
      
      for (const id in conteo) {
        const itemOriginal = inventario.find(p => p.id === id);
        const { error: errorStock } = await supabase.from('productos')
          .update({ stock: itemOriginal.stock - conteo[id] })
          .eq('id', id);
        if (errorStock) console.error("Error stock:", errorStock);
      }

      // 3. Éxito
      window.alert("✅ VENTA FINALIZADA Y STOCK ACTUALIZADO");
      setCarrito([]);
      await obtenerTodo(); // Refrescar datos
      setVista('historial');
    } catch (err) {
      console.error(err);
      window.alert("❌ Error al procesar venta. Revisa tu conexión.");
    }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    if (!infoPaca.numero || !infoPaca.proveedor) return window.alert("⚠️ Indica Paca y Proveedor.");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: parseFloat(nuevoProd.precio), costo_unitario: parseFloat(nuevoProd.costo), 
      stock: parseInt(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor 
    }]);
    if (!error) {
      setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
      obtenerTodo();
      inputNombreRef.current?.focus();
    }
  }

  async function guardarGasto(e) {
    e.preventDefault();
    const { error } = await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: parseFloat(nuevoGasto.monto) }]);
    if (!error) { setNuevoGasto({ concepto: '', monto: '' }); obtenerTodo(); }
  }

  // Estilos
  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const input = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box', outline: 'none' };

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color:'#10b981'}}>v11.8 FIX</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b', marginBottom:'5px'}}>
                    <span>Paca {p.paca}</span> <span style={{color: p.stockActual < 3 ? '#ef4444' : '#10b981', fontWeight:'bold'}}>Stock: {p.stockActual}</span>
                  </div>
                  <h4 style={{margin:'0 0 10px 0', fontSize:'13px', height:'32px', overflow:'hidden'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px', fontWeight:'bold'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CARRITO (POS) */}
        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <p style={{margin:0, color:'#10b981', fontSize:'11px'}}>TOTAL</p>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><b>{item.nombre}</b><br/><small>Paca {item.paca}</small></div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:'8px', width:'35px', height:'35px'}}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} style={{width:'100%', padding:'20px', background:'#10b981', color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold', fontSize:'18px', boxShadow:'0 4px 15px rgba(16,185,129,0.3)'}}>CONFIRMAR COMPRA ✅</button>
            )}
          </>
        )}

        {/* ADMIN */}
        {vista === 'admin' && (
          <div style={card}>
            <div style={{display:'flex', gap:'5px', marginBottom:'15px'}}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={input}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={input}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...input, marginBottom:'10px'}} required />
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px', marginBottom:'15px'}}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={input} required />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={input} required />
                <input type="number" placeholder="Stock" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={input} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>REGISTRAR LOTE ⚡</button>
            </form>
          </div>
        )}

        {/* HISTORIAL Y GASTOS */}
        {vista === 'historial' && (
          <>
            <div style={{...card, textAlign:'center', background:'#0f172a', color:'#fff'}}>
              <p style={{margin:0, fontSize:'11px', color:'#10b981'}}>UTILIDAD NETA HOY</p>
              <h2 style={{fontSize:'45px', margin:'10px 0'}}>${utilidadNeta}</h2>
            </div>
            <div style={card}>
              <h3 style={{fontSize:'12px', margin:'0 0 10px 0'}}>💸 REGISTRAR GASTO</h3>
              <form onSubmit={guardarGasto} style={{display:'flex', gap:'5px'}}>
                <input placeholder="Ej: Luz, Bolsas" value={nuevoGasto.concept} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={input} required />
                <input type="number" placeholder="$" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={{...input, width:'80px'}} required />
                <button style={{background:'#ef4444', color:'#fff', border:'none', borderRadius:'8px', padding:'0 15px'}}>+</button>
              </form>
            </div>
          </>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('catalogo')} style={{background: vista==='catalogo'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background: vista==='pos'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px', position:'relative'}}>🛒 {carrito.length>0 && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', color:'#fff', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('admin')} style={{background: vista==='admin'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: vista==='historial'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📈</button>
      </nav>
    </div>
  );
}
