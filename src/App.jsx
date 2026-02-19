import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234');
  const [passInput, setPassInput] = useState('');
  const [mostrandoLoginAdmin, setMostrandoLoginAdmin] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);
  
  const [tempUser, setTempUser] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [historial, setHistorial] = useState([]);
  
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
  const inputNombreRef = useRef(null);

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
  }

  // --- LÓGICA DE ACCESO SEGURO ---
  const intentarAccesoAdmin = (nuevaVista) => {
    if (['admin', 'historial'].includes(nuevaVista) && !isAdmin) {
      setVistaPendiente(nuevaVista);
      setMostrandoLoginAdmin(true);
    } else {
      setVista(nuevaVista);
    }
  };

  const confirmarPassword = () => {
    if (passInput === passMaestra) {
      setIsAdmin(true);
      setVista(vistaPendiente);
      setMostrandoLoginAdmin(false);
      setPassInput('');
    } else {
      alert("❌ Clave incorrecta");
      setPassInput('');
    }
  };

  const logout = () => { 
    setUsuario(''); 
    setIsAdmin(false); 
    localStorage.removeItem('userPacaPro'); 
  };

  // Acciones de Base de Datos (Idénticas a v15.0)
  async function actualizarCampo(id, campo, valor) {
    const { error } = await supabase.from('productos').update({ [campo]: campo === 'nombre' ? valor : Number(valor) }).eq('id', id);
    if (!error) obtenerTodo();
  }

  async function eliminarProducto(id, nombre) {
    if (window.confirm(`¿Eliminar "${nombre}"?`)) {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (!error) obtenerTodo();
    }
  }

  async function registrarVenta() {
    const vTotal = carrito.reduce((a, b) => a + b.precio, 0);
    const cTotal = carrito.reduce((a, b) => a + b.costo_unitario, 0);
    const { error } = await supabase.from('ventas').insert([{ vendedor: usuario, productos: carrito.map(p => p.nombre).join(', '), total: vTotal, costo_total: cTotal }]);
    if (!error) {
      for (const item of carrito) { await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id); }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta registrada");
    }
  }

  async function guardarProductoNuevo(e) {
    e.preventDefault();
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), 
      stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor, creado_por: usuario 
    }]);
    if (!error) { setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 }); obtenerTodo(); inputNombreRef.current?.focus(); }
  }

  const reporte = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const vTotal = vnt.reduce((a, b) => a + b.total, 0);
    const cTotal = vnt.reduce((a, b) => a + b.costo_total, 0);
    return { vnt, vTotal, ganancia: vTotal - cTotal };
  }, [historial, fechaConsulta]);

  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' },
    btnPrimary: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' },
    overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }
  };

  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: '#0f172a', margin: 0 }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '20px' }}>v15.1 SECURITY</p>
          <input placeholder="Nombre del vendedor" value={tempUser} onChange={e => setTempUser(e.target.value)} style={{ ...estilos.input, textAlign: 'center', marginBottom: '15px' }} />
          <button onClick={() => { if(tempUser) { setUsuario(tempUser); localStorage.setItem('userPacaPro', tempUser); }}} style={estilos.btnPrimary}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {/* MODAL DE CLAVE MAESTRA OCULTA */}
      {mostrandoLoginAdmin && (
        <div style={estilos.overlay}>
          <div style={{background:'#fff', padding:'25px', borderRadius:'20px', width:'100%', maxWidth:'300px', textAlign:'center'}}>
            <h3 style={{marginTop:0}}>🔐 Acceso Restringido</h3>
            <p style={{fontSize:'12px', color:'#64748b'}}>Ingrese la Clave Maestra para continuar</p>
            <input 
              type="password" 
              autoFocus
              placeholder="••••" 
              value={passInput} 
              onChange={e => setPassInput(e.target.value)} 
              style={{...estilos.input, textAlign:'center', fontSize:'24px', letterSpacing:'5px', marginBottom:'15px'}} 
            />
            <button onClick={confirmarPassword} style={{...estilos.btnPrimary, marginBottom:'10px'}}>VERIFICAR</button>
            <button onClick={() => {setMostrandoLoginAdmin(false); setPassInput('');}} style={{background:'none', border:'none', color:'#ef4444', fontSize:'12px', cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: isAdmin ? '#10b981' : '#f59e0b'}}>{isAdmin ? '🛡️ ADMIN' : '🛒 VENTAS'}</span></h2>
        <div style={{fontSize:'11px', opacity:0.8}}>{usuario} | <span onClick={logout} style={{textDecoration:'underline'}}>Salir</span></div>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#94a3b8'}}><span>Paca: {p.paca}</span> <span>Stk: {p.stock}</span></div>
                  <h4 style={{margin:'8px 0', fontSize:'14px'}}>{p.nombre}</h4>
                  <div style={{fontSize:'22px', fontWeight:'900'}}>${p.precio}</div>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{...estilos.btnPrimary, background:'#0f172a', marginTop:'10px'}}>+ VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <div style={{...estilos.card, background:'#1e293b', color:'#10b981'}}>
              <p style={{margin:0, color:'#fff'}}>TOTAL</p>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...estilos.card, display:'flex', justifyContent:'space-between'}}>
                <div style={{textAlign:'left'}}><b>{item.nombre}</b><br/>${item.precio}</div>
                <button onClick={()=>setCarrito(carrito.filter((_, idx) => idx !== i))} style={{border:'none', color:'#ef4444', background:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={registrarVenta} style={{...estilos.btnPrimary, padding:'20px'}}>COBRAR</button>}
          </div>
        )}

        {vista === 'admin' && isAdmin && (
          <>
            <div style={estilos.card}>
              <h3>⚡ REGISTRO</h3>
              <form onSubmit={guardarProductoNuevo}>
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input placeholder="N° Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
                  <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
                </div>
                <input ref={inputNombreRef} placeholder="Nombre prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} required />
                <div style={{display:'flex', gap:'5px'}}>
                  <input type="number" placeholder="Costo $" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} required />
                  <input type="number" placeholder="Venta $" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} required />
                  <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} required />
                </div>
                <button type="submit" style={{...estilos.btnPrimary, marginTop:'10px'}}>GUARDAR</button>
              </form>
            </div>
            <div style={estilos.card}>
              <input placeholder="🔍 Modificar producto..." value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
              {inventario.filter(p => p.nombre.toLowerCase().includes(busquedaAdmin.toLowerCase())).map(p => (
                <div key={p.id} style={{borderBottom:'1px solid #f1f5f9', padding:'10px 0'}}>
                   <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontWeight:'bold'}}>{p.nombre}</span>
                      <button onClick={()=>eliminarProducto(p.id, p.nombre)}>🗑️</button>
                   </div>
                   <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
                      <input type="number" defaultValue={p.precio} onBlur={(e)=>actualizarCampo(p.id, 'precio', e.target.value)} style={estilos.input} />
                      <input type="number" defaultValue={p.stock} onBlur={(e)=>actualizarCampo(p.id, 'stock', e.target.value)} style={estilos.input} />
                   </div>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'historial' && isAdmin && (
          <div style={estilos.card}>
             <h3>📈 GANANCIAS</h3>
             <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={estilos.input} />
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', margin:'15px 0'}}>
                <div style={{background:'#f8fafc', padding:'10px', borderRadius:'10px'}}>Venta: ${reporte.vTotal}</div>
                <div style={{background:'#ecfdf5', padding:'10px', borderRadius:'10px', color:'#059669'}}>Ganancia: ${reporte.ganancia}</div>
             </div>
             {reporte.vnt.map((v, i) => (
                <div key={i} style={{fontSize:'12px', borderBottom:'1px solid #eee', padding:'5px 0'}}>
                  {v.productos} <span style={{float:'right'}}>${v.total}</span>
                </div>
             ))}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '8px', borderRadius: '20px' }}>
        <button onClick={()=>intentarAccesoAdmin('catalogo')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button onClick={()=>intentarAccesoAdmin('pos')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='pos'?'#10b981':'#94a3b8'}}>🛒</button>
        <button onClick={()=>intentarAccesoAdmin('admin')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button onClick={()=>intentarAccesoAdmin('historial')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
