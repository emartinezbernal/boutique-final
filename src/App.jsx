import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- ESTADOS DE SESIÓN Y SEGURIDAD ---
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [tempUser, setTempUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234');
  const [passInput, setPassInput] = useState('');
  const [mostrandoLoginAdmin, setMostrandoLoginAdmin] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);
  
  // --- ESTADOS DE DATOS ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [filtroProvStats, setFiltroProvStats] = useState(''); 
  const [historial, setHistorial] = useState([]);
  
  const hoyStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }, []);
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

  // --- LÓGICA DE LOGIN ---
  const manejarIngreso = () => {
    if (tempUser.trim() !== '') {
      setUsuario(tempUser);
      localStorage.setItem('userPacaPro', tempUser);
    } else {
      alert("Por favor, ingresa un nombre de vendedor");
    }
  };

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

  // --- FUNCIONES DE VENTA ---
  async function registrarVenta() {
    const vTotal = carrito.reduce((a, b) => a + b.precio, 0);
    const cTotal = carrito.reduce((a, b) => a + b.costo_unitario, 0);
    const detalleProductos = carrito.map(p => `${p.nombre} [PROV: ${p.proveedor || 'N/A'}]`).join(' | ');

    const { error } = await supabase.from('ventas').insert([{ 
      vendedor: usuario, productos: detalleProductos, total: vTotal, costo_total: cTotal 
    }]);

    if (!error) {
      for (const item of carrito) { 
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id); 
      }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta registrada");
    }
  }

  // --- REPORTE INTEGRAL ---
  const reporteFinal = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    let ventasDia = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    if (filtroProvStats.trim() !== '') {
      ventasDia = ventasDia.filter(v => v.productos.toLowerCase().includes(filtroProvStats.toLowerCase()));
    }
    const vTotal = ventasDia.reduce((a, b) => a + b.total, 0);
    const cTotal = ventasDia.reduce((a, b) => a + b.costo_total, 0);
    return { vnt: ventasDia, vTotal, ganancia: vTotal - cTotal };
  }, [historial, fechaConsulta, filtroProvStats]);

  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' },
    btnPrimary: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.95)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }
  };

  // --- PANTALLA DE ACCESO ---
  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: '#0f172a', margin: 0 }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '11px', marginBottom: '25px' }}>v15.5 CORREGIDA</p>
          <input 
            placeholder="Nombre del Vendedor" 
            value={tempUser}
            onChange={e => setTempUser(e.target.value)} 
            style={{ ...estilos.input, textAlign: 'center', marginBottom: '15px' }} 
          />
          <button onClick={manejarIngreso} style={estilos.btnPrimary}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      
      {/* MODAL CLAVE MAESTRA */}
      {mostrandoLoginAdmin && (
        <div style={estilos.overlay}>
          <div style={{background:'#fff', padding:'25px', borderRadius:'20px', width:'100%', maxWidth:'300px', textAlign:'center'}}>
            <h3 style={{marginTop:0}}>🔐 Clave Maestra</h3>
            <input type="password" autoFocus value={passInput} onChange={e => setPassInput(e.target.value)} style={{...estilos.input, textAlign:'center', fontSize:'24px', letterSpacing:'5px', marginBottom:'15px'}} />
            <button onClick={confirmarPassword} style={estilos.btnPrimary}>ACCEDER</button>
            <button onClick={()=>{setMostrandoLoginAdmin(false); setPassInput('');}} style={{background:'none', border:'none', marginTop:'15px', color:'#ef4444', cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: isAdmin ? '#10b981' : '#f59e0b'}}>{isAdmin ? '🛡️ ADMIN' : '🛒 VENTAS'}</span></h2>
        <div style={{fontSize:'10px', opacity:0.7}}>{usuario} | <span onClick={()=>{setUsuario(''); localStorage.removeItem('userPacaPro');}} style={{textDecoration:'underline'}}>Cerrar Sesión</span></div>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#94a3b8'}}><span>{p.proveedor}</span> <span>Stk: {p.stock}</span></div>
                  <h4 style={{margin:'8px 0', fontSize:'14px'}}>{p.nombre}</h4>
                  <div style={{fontSize:'22px', fontWeight:'900'}}>${p.precio}</div>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{...estilos.btnPrimary, background:'#0f172a', marginTop:'10px'}}>+ VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ESTADÍSTICAS COMPLETAS (PROVEEDORES) */}
        {vista === 'historial' && isAdmin && (
          <div style={estilos.card}>
             <h3 style={{marginTop:0}}>📈 ESTADÍSTICAS Y PROVEEDORES</h3>
             <div style={{display:'flex', gap:'5px', marginBottom:'15px'}}>
               <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...estilos.input, flex:1}} />
               <input placeholder="Filtrar Proveedor..." value={filtroProvStats} onChange={e=>setFiltroProvStats(e.target.value)} style={{...estilos.input, flex:1.2, border:'2px solid #10b981'}} />
             </div>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                <div style={{background:'#f8fafc', padding:'10px', borderRadius:'10px', textAlign:'center'}}>
                   <small>INGRESOS</small><br/><b>${reporteFinal.vTotal}</b>
                </div>
                <div style={{background:'#ecfdf5', padding:'10px', borderRadius:'10px', textAlign:'center', color:'#059669'}}>
                   <small>UTILIDAD</small><br/><b>${reporteFinal.ganancia}</b>
                </div>
             </div>
             <div style={{overflowX: 'auto'}}>
               <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
                 <thead>
                   <tr style={{background:'#0f172a', color:'#fff'}}>
                     <th style={{padding:'10px', textAlign:'left'}}>HORA</th>
                     <th style={{padding:'10px', textAlign:'left'}}>PRODUCTOS Y PROVEEDOR</th>
                     <th style={{padding:'10px', textAlign:'right'}}>TOTAL</th>
                   </tr>
                 </thead>
                 <tbody>
                   {reporteFinal.vnt.map((v, i) => (
                     <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                       <td style={{padding:'10px'}}>{new Date(v.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                       <td style={{padding:'10px'}}>{v.productos}</td>
                       <td style={{padding:'10px', textAlign:'right', fontWeight:'bold'}}>${v.total}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {/* GESTIÓN (ADMIN) */}
        {vista === 'admin' && isAdmin && (
          <div style={estilos.card}>
            <h3>⚡ CARGAR PRODUCTO</h3>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="N° Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
            </div>
            <input ref={inputNombreRef} placeholder="Nombre Prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} />
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} />
            </div>
            <button onClick={async()=>{
               await supabase.from('productos').insert([{nombre:nuevoProd.nombre, precio:Number(nuevoProd.precio), costo_unitario:Number(nuevoProd.costo), stock:Number(nuevoProd.cantidad), paca:infoPaca.numero, proveedor:infoPaca.proveedor}]);
               setNuevoProd({...nuevoProd, nombre:''}); obtenerTodo();
            }} style={estilos.btnPrimary}>GUARDAR EN INVENTARIO</button>
          </div>
        )}

        {/* CARRITO (POS) */}
        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <div style={{...estilos.card, background:'#1e293b', color:'#10b981'}}>
              <h2 style={{fontSize:'40px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...estilos.card, display:'flex', justifyContent:'space-between'}}>
                <span>{item.nombre}</span>
                <button onClick={()=>setCarrito(carrito.filter((_, idx)=>idx!==i))} style={{color:'#ef4444', border:'none', background:'none'}}>Eliminar</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={registrarVenta} style={{...estilos.btnPrimary, padding:'20px'}}>FINALIZAR VENTA</button>}
          </div>
        )}

      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '10px', borderRadius: '25px' }}>
        <button onClick={()=>intentarAccesoAdmin('catalogo')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button onClick={()=>intentarAccesoAdmin('pos')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='pos'?'#10b981':'#94a3b8'}}>🛒</button>
        <button onClick={()=>intentarAccesoAdmin('admin')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button onClick={()=>intentarAccesoAdmin('historial')} style={{background:'none', border:'none', fontSize:'22px', color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
