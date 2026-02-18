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

  // --- LÓGICA DE STOCK Y MÉTRICAS ---
  const inventarioReal = useMemo(() => {
    return inventario.map(p => {
      const enCarrito = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: p.stock - enCarrito };
    });
  }, [inventario, carrito]);

  const hoy = new Date().toLocaleDateString();
  const ventasHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === hoy);
  const gastosHoy = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === hoy);

  const totalVendidoHoy = ventasHoy.reduce((a, b) => a + (b.total || 0), 0);
  const totalCostoVentaHoy = ventasHoy.reduce((a, b) => a + (b.costo_total || 0), 0);
  const totalGastosHoy = gastosHoy.reduce((a, b) => a + Number(b.monto || 0), 0);
  const utilidadNetaHoy = totalVendidoHoy - totalCostoVentaHoy - totalGastosHoy;

  // --- ACCIONES REFORZADAS ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;
    try {
      const { error: errVenta } = await supabase.from('ventas').insert([{ 
        total: carrito.reduce((a, b) => a + b.precio, 0), 
        costo_total: carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0), 
        detalles: carrito.map(i => i.nombre).join(', ') 
      }]);
      if (errVenta) throw errVenta;

      for (const item of carrito) {
        const itemDB = inventario.find(p => p.id === item.id);
        if (itemDB) await supabase.from('productos').update({ stock: itemDB.stock - 1 }).eq('id', item.id);
      }
      alert("✅ Venta Guardada");
      setCarrito([]); await obtenerTodo(); setVista('historial');
    } catch (err) { alert("❌ Error: Verifica conexión o SQL"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), 
      stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor 
    }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo(); inputNombreRef.current?.focus();
  }

  async function guardarGasto(e) {
    e.preventDefault();
    await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
    setNuevoGasto({ concepto: '', monto: '' });
    obtenerTodo();
  }

  // Estilos
  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color:'#10b981'}}>v12.1 STATS</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b'}}>
                    <span>#{p.paca}</span> <span style={{color: p.stockActual < 3 ? '#ef4444' : '#10b981', fontWeight:'bold'}}>Stock: {p.stockActual}</span>
                  </div>
                  <h4 style={{margin:'8px 0', fontSize:'13px', height:'32px', overflow:'hidden'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px', fontWeight:'bold'}}>VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VISTA CARRITO */}
        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><b>{item.nombre}</b><br/><small>Paca {item.paca}</small></div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:'8px', width:'35px', height:'35px'}}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'20px', background:'#10b981', color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold', fontSize:'18px'}}>CONFIRMAR ✅</button>}
          </>
        )}

        {/* VISTA ESTADÍSTICA (REVISADA) */}
        {vista === 'historial' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <p style={{margin:0, color:'#10b981', fontSize:'11px'}}>UTILIDAD NETA HOY</p>
              <h2 style={{fontSize:'45px', margin:'5px 0'}}>${utilidadNetaHoy}</h2>
              <div style={{fontSize:'12px', opacity:0.7}}>Vendido: ${totalVendidoHoy} | Gastos: ${totalGastosHoy}</div>
            </div>

            <div style={card}>
              <h3 style={{fontSize:'12px', color:'#64748b', marginBottom:'10px'}}>💸 REGISTRAR GASTO</h3>
              <form onSubmit={guardarGasto} style={{display:'flex', gap:'5px'}}>
                <input placeholder="Concepto" value={nuevoGasto.concepto} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="$" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={{...inputStyle, width:'90px'}} required />
                <button style={{background:'#ef4444', color:'#fff', border:'none', borderRadius:'8px', padding:'0 15px', fontWeight:'bold'}}>+</button>
              </form>
            </div>

            <div style={card}>
              <h3 style={{fontSize:'12px', color:'#64748b', marginBottom:'10px'}}>📊 RENDIMIENTO PROVEEDORES</h3>
              <div style={{maxHeight:'200px', overflowY:'auto'}}>
                <table style={{width:'100%', fontSize:'12px', textAlign:'left'}}>
                  <thead><tr style={{color:'#94a3b8'}}><th>PROV.</th><th>PZS</th><th>INV.</th></tr></thead>
                  <tbody>
                    {Object.entries(inventario.reduce((acc, p) => {
                      const key = p.proveedor || 'S/P';
                      if (!acc[key]) acc[key] = {s:0, i:0};
                      acc[key].s += p.stock; acc[key].i += (p.stock * p.costo_unitario);
                      return acc;
                    }, {})).map(([n, d]) => (
                      <tr key={n} style={{borderTop:'1px solid #f1f5f9'}}><td style={{padding:'8px 0'}}>{n}</td><td>{d.s}</td><td>${d.i}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={() => {
              const fisico = window.prompt(`CIERRE DE CAJA\nEfectivo esperado: $${totalVendidoHoy - totalGastosHoy}\n(Ventas - Gastos)\n\nIngrese monto físico:`);
              if (fisico) alert(`Resultado: $${Number(fisico) - (totalVendidoHoy - totalGastosHoy)} de diferencia.`);
            }} style={{width:'100%', padding:'15px', background:'#0f172a', color:'#fff', border:'none', borderRadius:'12px', fontWeight:'bold'}}>ARQUEO DE CAJA 🏁</button>
          </>
        )}

        {/* VISTA ADMIN */}
        {vista === 'admin' && (
          <div style={card}>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputStyle}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputStyle}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" placeholder="Cost" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Vent" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>REGISTRAR ⚡</button>
            </form>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px', boxShadow: '0 8px 15px rgba(0,0,0,0.2)' }}>
        <button onClick={()=>setVista('catalogo')} style={{background: vista==='catalogo'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background: vista==='pos'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px', position:'relative'}}>🛒 {carrito.length>0 && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', color:'#fff', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('admin')} style={{background: vista==='admin'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: vista==='historial'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📈</button>
      </nav>
    </div>
  );
}
