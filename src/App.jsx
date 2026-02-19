import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const CLAVE_MAESTRA = "1234";

export default function App() {
  // --- ESTADOS ---
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrandoPad, setMostrandoPad] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [vistaPendiente, setVistaPendiente] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState(JSON.parse(localStorage.getItem('cortesPacaPro')) || []);
  
  const obtenerFechaLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const hoyStr = useMemo(() => obtenerFechaLocal(), []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);
  useEffect(() => { localStorage.setItem('cortesPacaPro', JSON.stringify(cortes)); }, [cortes]);

  async function obtenerTodo() {
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (p) setInventario(p);
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      if (v) setHistorial(v);
      const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
      if (g) setGastos(g);
    } catch (e) { console.error("Error cargando datos", e); }
  }

  // --- LÓGICA DE FILTRADO CORREGIDA (Solución al Total $0) ---
  const filtrados = useMemo(() => {
    // Convertimos la fecha de consulta a un formato comparable (AAAA-MM-DD)
    const vnt = historial.filter(v => v.created_at.split('T')[0] === fechaConsulta);
    const gst = gastos.filter(g => g.created_at.split('T')[0] === fechaConsulta);
    
    const totalV = vnt.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const totalC = vnt.reduce((a, b) => a + (Number(b.costo_total) || 0), 0);
    const totalG = gst.reduce((a, b) => a + (Number(b.monto) || 0), 0);
    
    return { vnt, gst, totalV, totalG, utilidad: totalV - totalC - totalG };
  }, [historial, gastos, fechaConsulta]);

  const statsProveedores = useMemo(() => {
    const stats = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'Sin Nombre';
      if (!stats[prov]) stats[prov] = { stock: 0, inversion: 0, ventaEsperada: 0 };
      stats[prov].stock += (p.stock || 0);
      stats[prov].inversion += ((p.stock || 0) * (p.costo_unitario || 0));
      stats[prov].ventaEsperada += ((p.stock || 0) * (p.precio || 0));
    });
    return Object.entries(stats);
  }, [inventario]);

  // --- ACCIONES ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const totalV = carrito.reduce((a, b) => a + (b.precio || 0), 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    
    try {
      // 1. Registrar venta
      await supabase.from('ventas').insert([{ 
        total: totalV, 
        costo_total: costoV, 
        vendedor: usuario, 
        detalles: mTxt 
      }]);
      
      // 2. Descontar stock
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      
      // 3. WHATSAPP
      window.open(`https://wa.me/?text=${encodeURIComponent(`🛍️ TICKET\n💰 Total: $${totalV}\n💳 Pago: ${mTxt}`)}`, '_blank');
      
      // 4. ACTUALIZACIÓN INMEDIATA
      setCarrito([]);
      await obtenerTodo(); // Forzamos recarga de Supabase para actualizar la gráfica/total
      setVista('catalogo');
    } catch (e) { alert("Error al procesar venta"); }
  }

  const realizarCorte = () => {
    const f = window.prompt(`¿Efectivo físico en caja?`);
    if (!f) return;
    const fisico = Number(f);
    const dif = fisico - (filtrados.totalV - filtrados.totalG);
    const nuevoCorte = { id: Date.now(), fecha: fechaConsulta, ventas: filtrados.totalV, gastos: filtrados.totalG, fisico, diferencia: dif };
    setCortes([nuevoCorte, ...cortes]);
    alert("Corte realizado y guardado localmente");
  };

  const actualizarCampoInline = async (id, campo, valor) => {
    const valorNum = Number(valor);
    if (isNaN(valorNum)) return;
    try {
      await supabase.from('productos').update({ [campo]: valorNum }).eq('id', id);
      setInventario(inventario.map(p => p.id === id ? { ...p, [campo]: valorNum } : p));
    } catch (e) { obtenerTodo(); }
  };

  // --- DISEÑO (REDUCIDO PARA VERCEL) ---
  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box', marginBottom: '8px' };
  const btnN = { background: '#0f172a', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold' };

  if (!usuario) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...card, width: '300px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Tu Nombre" onChange={e => setTempNombre(e.target.value)} style={inputS} />
          <button onClick={() => { if(tempNombre){ setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ ...btnN, width: '100%', background: '#10b981' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {mostrandoPad && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ ...card, width: '280px' }}>
            <h3>🔐 Admin</h3>
            <input type="password" autoFocus style={{ ...inputS, textAlign:'center' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (passInput === CLAVE_MAESTRA ? (setIsAdmin(true), setVista(vistaPendiente), setMostrandoPad(false), setPassInput('')) : alert("Clave mal"))} />
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', display:'flex', justifyContent:'space-between' }}>
        <b>PACA PRO {isAdmin && "⭐"}</b>
        <span>👤 {usuario}</span>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={inputS} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <small>Paca: {p.paca} | Stock: {p.stock}</small>
                  <h4 style={{margin:'5px 0'}}>{p.nombre}</h4>
                  <b>${p.precio}</b>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ ...btnN, width: '100%', marginTop: '10px', background: '#10b981' }}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={card}>
            <h3>🛒 Carrito</h3>
            {carrito.map((it, i) => <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #eee'}}><span>{it.nombre}</span><b>${it.precio}</b></div>)}
            <h2>Total: ${carrito.reduce((a,b)=>a+(b.precio||0),0)}</h2>
            <button onClick={finalizarVenta} style={{ ...btnN, width: '100%', padding: '15px' }}>COBRAR</button>
          </div>
        )}

        {vista === 'admin' && isAdmin && (
          <div style={card}>
            <h3>📦 Gestión Inventario</h3>
            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', fontSize: '11px'}}>
                <thead><tr><th>Producto</th><th>Paca</th><th>$</th><th>Stock</th></tr></thead>
                <tbody>
                  {inventario.map(p => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.paca}</td>
                      <td><input defaultValue={p.precio} onBlur={e=>actualizarCampoInline(p.id,'precio',e.target.value)} style={{width:'40px'}} /></td>
                      <td><input defaultValue={p.stock} onBlur={e=>actualizarCampoInline(p.id,'stock',e.target.value)} style={{width:'40px'}} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === 'historial' && isAdmin && (
          <>
            <div style={{ ...card, background: '#0f172a', color: '#fff' }}>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={inputS} />
              <div style={{ display:'flex', justifyContent:'space-around', marginTop: '10px' }}>
                <div><small>Ventas</small><h3>${filtrados.totalV}</h3></div>
                <div><small>Utilidad</small><h3>${filtrados.utilidad}</h3></div>
              </div>
              <button onClick={realizarCorte} style={{ ...btnN, width: '100%', background: '#10b981' }}>CERRAR DÍA</button>
            </div>
            
            <div style={card}>
              <h3>💸 Registrar Gasto</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
                setNuevoGasto({ concepto: '', monto: '' }); obtenerTodo();
              }}>
                <input placeholder="Concepto" value={nuevoGasto.concepto} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={inputS} required />
                <input type="number" placeholder="Monto" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={inputS} required />
                <button style={{ ...btnN, width: '100%', background: '#ef4444' }}>GUARDAR GASTO</button>
              </form>
            </div>
          </>
        )}
      </main>

      <nav style={{ position:'fixed', bottom:'20px', left:'20px', right:'20px', background:'#0f172a', display:'flex', justifyContent:'space-around', padding:'12px', borderRadius:'20px' }}>
        <button onClick={()=>setVista('catalogo')} style={{background:'none', border:'none', fontSize:'24px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background:'none', border:'none', fontSize:'24px'}}>🛒</button>
        <button onClick={()=>intentarEntrarA('admin')} style={{background:'none', border:'none', fontSize:'24px'}}>⚡</button>
        <button onClick={()=>intentarEntrarA('historial')} style={{background:'none', border:'none', fontSize:'24px'}}>📈</button>
      </nav>
    </div>
  );
}
