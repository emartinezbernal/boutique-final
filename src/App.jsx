import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión única verificada
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- ESTADOS DE SESIÓN ---
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [tempUser, setTempUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234');
  const [passInput, setPassInput] = useState('');
  const [mostrandoLoginAdmin, setMostrandoLoginAdmin] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);
  
  // --- ESTADOS DE APP ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [filtroProvStats, setFiltroProvStats] = useState(''); 
  const [historial, setHistorial] = useState([]);
  
  // Manejo de fecha local para reportes
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

  // --- LÓGICA DE NAVEGACIÓN Y SEGURIDAD ---
  const manejarIngreso = () => {
    if (tempUser.trim()) {
      setUsuario(tempUser);
      localStorage.setItem('userPacaPro', tempUser);
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

  // --- ACCIONES DE VENTA ---
  async function registrarVenta() {
    const vTotal = carrito.reduce((a, b) => a + b.precio, 0);
    const cTotal = carrito.reduce((a, b) => a + b.costo_unitario, 0);
    const detalleRaw = carrito.map(p => `${p.nombre} (${p.proveedor || 'N/A'})`).join(', ');

    const { error } = await supabase.from('ventas').insert([{ 
      vendedor: usuario, productos: detalleRaw, total: vTotal, costo_total: cTotal 
    }]);

    if (!error) {
      for (const item of carrito) {
        const { data: cur } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        await supabase.from('productos').update({ stock: (cur?.stock || 1) - 1 }).eq('id', item.id);
      }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta Guardada");
    }
  }

  // --- REPORTE CON FILTRO DE PROVEEDOR ---
  const reporteCalculado = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    let ventasDia = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    
    if (filtroProvStats.trim()) {
      ventasDia = ventasDia.filter(v => v.productos.toLowerCase().includes(filtroProvStats.toLowerCase()));
    }

    const ingresos = ventasDia.reduce((a, b) => a + b.total, 0);
    const costos = ventasDia.reduce((a, b) => a + b.costo_total, 0);
    return { lista: ventasDia, ingresos, utilidad: ingresos - costos };
  }, [historial, fechaConsulta, filtroProvStats]);

  // --- ESTILOS ---
  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' },
    btnPrimary: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor:'pointer' },
    overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(15, 23, 42, 0.95)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }
  };

  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: '#0f172a', margin: 0, letterSpacing:'-1px' }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '25px' }}>v15.6 MASTER UPDATE</p>
          <input placeholder="Nombre Vendedor" value={tempUser} onChange={e=>setTempUser(e.target.value)} style={{ ...estilos.input, textAlign: 'center', marginBottom: '15px' }} />
          <button onClick={manejarIngreso} style={estilos.btnPrimary}>ENTRAR AL SISTEMA</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      
      {mostrandoLoginAdmin && (
        <div style={estilos.overlay}>
          <div style={{background:'#fff', padding:'25px', borderRadius:'20px', width:'100%', maxWidth:'300px', textAlign:'center'}}>
            <h3 style={{marginTop:0}}>🔐 Acceso Maestro</h3>
            <input type="password" autoFocus value={passInput} onChange={e => setPassInput(e.target.value)} style={{...estilos.input, textAlign:'center', fontSize:'24px', letterSpacing:'5px', marginBottom:'15px'}} />
            <button onClick={confirmarPassword} style={estilos.btnPrimary}>VERIFICAR</button>
            <button onClick={()=>{setMostrandoLoginAdmin(false); setPassInput('');}} style={{background:'none', border:'none', marginTop:'15px', color:'#ef4444'}}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: isAdmin ? '#10b981' : '#f59e0b'}}>{isAdmin ? '🛡️ ADMIN' : '🛒 VENTAS'}</span></h2>
        <div style={{fontSize:'10px', opacity:0.7}}>{usuario} | <span onClick={()=>{setUsuario(''); localStorage.removeItem('userPacaPro');}} style={{textDecoration:'underline'}}>Salir</span></div>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* VISTA CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
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

        {/* VISTA ESTADÍSTICAS (Con Tabla de Proveedores y Filtro) */}
        {vista === 'historial' && isAdmin && (
          <div style={estilos.card}>
             <h3 style={{marginTop:0}}>📈 Reporte de Proveedores</h3>
             <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
               <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...estilos.input, flex:1}} />
               <input placeholder="🔍 Buscar Proveedor" value={filtroProvStats} onChange={e=>setFiltroProvStats(e.target.value)} style={{...estilos.input, flex:1.2, border:'2px solid #10b981'}} />
             </div>
             
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                <div style={{background:'#f8fafc', padding:'15px', borderRadius:'10px', textAlign:'center', border:'1px solid #e2e8f0'}}>
                   <small style={{color:'#64748b'}}>VENTA FILTRADA</small><br/><b style={{fontSize:'20px'}}>${reporteCalculado.ingresos}</b>
                </div>
                <div style={{background:'#ecfdf5', padding:'15px', borderRadius:'10px', textAlign:'center', color:'#059669', border:'1px solid #bbf7d0'}}>
                   <small>UTILIDAD NETA</small><br/><b style={{fontSize:'20px'}}>${reporteCalculado.utilidad}</b>
                </div>
             </div>

             <div style={{overflowX: 'auto'}}>
               <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
                 <thead>
                   <tr style={{background:'#0f172a', color:'#fff', textAlign:'left'}}>
                     <th style={{padding:'10px'}}>HORA</th>
                     <th style={{padding:'10px'}}>DESCRIPCIÓN Y PROVEEDOR</th>
                     <th style={{padding:'10px', textAlign:'right'}}>MONTO</th>
                   </tr>
                 </thead>
                 <tbody>
                   {reporteCalculado.lista.map((v, i) => (
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

        {/* VISTA GESTIÓN INVENTARIO */}
        {vista === 'admin' && isAdmin && (
          <div style={estilos.card}>
            <h3>⚡ CARGA DE INVENTARIO</h3>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="Paca #" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
            </div>
            <input ref={inputNombreRef} placeholder="Nombre del Artículo" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} />
            <div style={{display:'flex', gap:'5px', marginBottom:'15px'}}>
              <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} />
            </div>
            <button onClick={async()=>{
               if(!nuevoProd.nombre || !nuevoProd.precio) return alert("Faltan datos");
               await supabase.from('productos').insert([{
                 nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), 
                 costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), 
                 paca: infoPaca.numero, proveedor: infoPaca.proveedor
               }]);
               setNuevoProd({...nuevoProd, nombre: ''}); obtenerTodo();
            }} style={estilos.btnPrimary}>GUARDAR PRODUCTO</button>

            <hr style={{margin:'25px 0', opacity:0.2}}/>
            <input placeholder="🔍 Buscar para editar stock..." value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)} style={estilos.input} />
            {inventario.filter(p => p.nombre.toLowerCase().includes(busquedaAdmin.toLowerCase())).map(p => (
              <div key={p.id} style={{padding:'12px 0', borderBottom:'1px solid #f1f5f9'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                  <b>{p.nombre} <small style={{color:'#94a3b8'}}>[{p.proveedor}]</small></b>
                  <button onClick={async()=>{if(window.confirm('¿Eliminar?')){await supabase.from('productos').delete().eq('id',p.id); obtenerTodo();}}} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                </div>
                <div style={{display:'flex', gap:'8px'}}>
                  <input type="number" defaultValue={p.precio} onBlur={e=>supabase.from('productos').update({precio:Number(e.target.value)}).eq('id',p.id).then(obtenerTodo)} style={{...estilos.input, padding:'5px'}} />
                  <input type="number" defaultValue={p.stock} onBlur={e=>supabase.from('productos').update({stock:Number(e.target.value)}).eq('id',p.id).then(obtenerTodo)} style={{...estilos.input, padding:'5px'}} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISTA CAJA (POS) */}
        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <div style={{...estilos.card, background:'#0f172a', color:'#10b981'}}>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
              <small style={{color:'#fff', opacity:0.6}}>TOTAL CARRITO</small>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...estilos.card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{textAlign:'left'}}><b>{item.nombre}</b><br/><small>{item.proveedor}</small></div>
                <button onClick={()=>setCarrito(carrito.filter((_, idx)=>idx!==i))} style={{color:'#ef4444', border:'none', background:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 ? (
              <button onClick={registrarVenta} style={{...estilos.btnPrimary, padding:'20px', fontSize:'18px'}}>REGISTRAR VENTA</button>
            ) : <p style={{color:'#94a3b8', marginTop:'40px'}}>El carrito está vacío</p>}
          </div>
        )}

      </main>

      {/* NAVEGACIÓN INFERIOR */}
      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '10px', borderRadius: '25px', boxShadow:'0 10px 30px rgba(0,0,0,0.3)' }}>
        <button onClick={()=>intentarAccesoAdmin('catalogo')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button onClick={()=>intentarAccesoAdmin('pos')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='pos'?'#10b981':'#94a3b8', position:'relative'}}>
          🛒 {carrito.length > 0 && <span style={{position:'absolute', top:'-5px', right:'-5px', background:'#ef4444', color:'#fff', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}
        </button>
        <button onClick={()=>intentarAccesoAdmin('admin')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button onClick={()=>intentarAccesoAdmin('historial')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
