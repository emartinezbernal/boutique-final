import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- ESTADOS ---
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234'); // Clave por defecto
  const [tempUser, setTempUser] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [historial, setHistorial] = useState([]);
  
  // Manejo de Fechas
  const obtenerFechaLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };
  const hoyStr = useMemo(() => obtenerFechaLocal(), []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);

  // Formulario nuevo producto
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const inputNombreRef = useRef(null);

  // --- CARGA DE DATOS ---
  useEffect(() => { 
    if (usuario) obtenerTodo(); 
  }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
  }

  // --- LÓGICA DE NAVEGACIÓN Y ACCESO ---
  const verificarAdmin = (nuevaVista) => {
    if (['admin', 'historial'].includes(nuevaVista) && !isAdmin) {
      const pass = window.prompt("🔐 Ingrese Clave Maestra para acceder a funciones de administración:");
      if (pass === passMaestra) { 
        setIsAdmin(true); 
        setVista(nuevaVista); 
      } else { 
        alert("❌ Acceso denegado: Clave incorrecta"); 
      }
    } else { 
      setVista(nuevaVista); 
    }
  };

  const logout = () => { 
    setUsuario(''); 
    setIsAdmin(false); 
    localStorage.removeItem('userPacaPro'); 
  };

  // --- ACCIONES DE GESTIÓN (ADMIN) ---
  async function actualizarCampo(id, campo, valor) {
    const { error } = await supabase
      .from('productos')
      .update({ [campo]: campo === 'nombre' ? valor : Number(valor) })
      .eq('id', id);
    
    if (error) alert("Error al actualizar");
    else obtenerTodo();
  }

  async function eliminarProducto(id, nombre) {
    if (window.confirm(`¿Seguro que deseas eliminar "${nombre}"?`)) {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) alert("Error al eliminar");
      else obtenerTodo();
    }
  }

  async function registrarVenta() {
    const ventaTotal = carrito.reduce((a, b) => a + b.precio, 0);
    const costoTotal = carrito.reduce((a, b) => a + b.costo_unitario, 0);

    const { error } = await supabase.from('ventas').insert([{
      vendedor: usuario,
      productos: carrito.map(p => p.nombre).join(', '),
      total: ventaTotal,
      costo_total: costoTotal
    }]);

    if (!error) {
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]);
      obtenerTodo();
      setVista('catalogo');
      alert("✅ Venta registrada con éxito");
    }
  }

  async function guardarProductoNuevo(e) {
    e.preventDefault();
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: Number(nuevoProd.precio), 
      costo_unitario: Number(nuevoProd.costo), 
      stock: Number(nuevoProd.cantidad), 
      paca: infoPaca.numero, 
      proveedor: infoPaca.proveedor, 
      creado_por: usuario 
    }]);

    if (!error) {
      setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
      obtenerTodo();
      inputNombreRef.current?.focus();
    }
  }

  // --- CÁLCULOS DE REPORTE ---
  const reporte = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const vTotal = vnt.reduce((a, b) => a + b.total, 0);
    const cTotal = vnt.reduce((a, b) => a + b.costo_total, 0);
    return { vnt, vTotal, ganancia: vTotal - cTotal };
  }, [historial, fechaConsulta]);

  // --- ESTILOS ---
  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box', fontSize: '14px' },
    btnPrimary: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    btnNav: { background: 'none', border: 'none', fontSize: '22px', padding: '10px', cursor: 'pointer' }
  };

  // --- VISTA DE LOGIN ---
  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: '#0f172a', margin: 0, letterSpacing: '-1px' }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '25px' }}>v15.0 FINAL</p>
          <input placeholder="Nombre del vendedor" value={tempUser} onChange={e => setTempUser(e.target.value)} style={{ ...estilos.input, textAlign: 'center', marginBottom: '15px' }} />
          <button onClick={() => { if(tempUser) { setUsuario(tempUser); localStorage.setItem('userPacaPro', tempUser); }}} style={estilos.btnPrimary}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: isAdmin ? '#10b981' : '#f59e0b'}}>{isAdmin ? '🛡️ MODO ADMIN' : '🛒 VENTAS'}</span></h2>
        <div style={{fontSize:'11px', opacity:0.8}}>Vendedor: {usuario} | <span onClick={logout} style={{textDecoration:'underline'}}>Cerrar Sesión</span></div>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* VISTA CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#94a3b8'}}><span>Paca: {p.paca}</span> <span>Stock: {p.stock}</span></div>
                  <h4 style={{margin:'8px 0', fontSize:'14px'}}>{p.nombre}</h4>
                  <div style={{fontSize:'22px', fontWeight:'900', color:'#0f172a'}}>${p.precio}</div>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{...estilos.btnPrimary, background:'#0f172a', marginTop:'10px'}}>+ VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VISTA POS (CARRITO) */}
        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <h3 style={{color:'#64748b'}}>RESUMEN DE VENTA</h3>
            <div style={{...estilos.card, background:'#1e293b', color:'#10b981'}}>
              <p style={{margin:0, fontSize:'14px', color:'#fff'}}>TOTAL A COBRAR</p>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...estilos.card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{textAlign:'left'}}>
                  <div style={{fontWeight:'bold'}}>{item.nombre}</div>
                  <div style={{fontSize:'12px', color:'#64748b'}}>${item.precio}</div>
                </div>
                <button onClick={()=>setCarrito(carrito.filter((_, idx) => idx !== i))} style={{background:'#fee2e2', color:'#ef4444', border:'none', padding:'8px 12px', borderRadius:'8px'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 ? (
              <button onClick={registrarVenta} style={{...estilos.btnPrimary, fontSize:'18px', padding:'20px'}}>FINALIZAR VENTA</button>
            ) : <p>El carrito está vacío</p>}
          </div>
        )}

        {/* VISTA ADMIN (ALTAS Y GESTIÓN) */}
        {vista === 'admin' && isAdmin && (
          <>
            <div style={estilos.card}>
              <h3 style={{marginTop:0}}>⚡ REGISTRO DE MERCANCÍA</h3>
              <form onSubmit={guardarProductoNuevo}>
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input placeholder="N° Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
                  <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
                </div>
                <input ref={inputNombreRef} placeholder="Nombre de la prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} required />
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input type="number" placeholder="Costo $" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} required />
                  <input type="number" placeholder="Venta $" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} required />
                  <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} required />
                </div>
                <button type="submit" style={estilos.btnPrimary}>AÑADIR AL INVENTARIO</button>
              </form>
            </div>

            <div style={{...estilos.card, borderTop:'5px solid #3b82f6'}}>
              <h3 style={{marginTop:0}}>✏️ EDITAR PRECIOS / STOCK</h3>
              <input placeholder="Buscar producto para modificar..." value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)} style={{...estilos.input, marginBottom:'15px', background:'#f1f5f9'}} />
              
              {inventario.filter(p => p.nombre.toLowerCase().includes(busquedaAdmin.toLowerCase())).map(p => (
                <div key={p.id} style={{borderBottom:'1px solid #f1f5f9', padding:'10px 0'}}>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontWeight:'bold', fontSize:'13px'}}>{p.nombre}</span>
                      <button onClick={()=>eliminarProducto(p.id, p.nombre)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                   </div>
                   <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
                      <div style={{flex:1}}>
                        <label style={{fontSize:'10px', color:'#64748b'}}>PRECIO VENTA</label>
                        <input type="number" defaultValue={p.precio} onBlur={(e)=>actualizarCampo(p.id, 'precio', e.target.value)} style={{...estilos.input, padding:'5px'}} />
                      </div>
                      <div style={{flex:1}}>
                        <label style={{fontSize:'10px', color:'#64748b'}}>STOCK DISPONIBLE</label>
                        <input type="number" defaultValue={p.stock} onBlur={(e)=>actualizarCampo(p.id, 'stock', e.target.value)} style={{...estilos.input, padding:'5px'}} />
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VISTA REPORTES */}
        {vista === 'historial' && isAdmin && (
          <div style={estilos.card}>
             <h3 style={{marginTop:0}}>📈 RENDIMIENTO DIARIO</h3>
             <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...estilos.input, marginBottom:'20px'}} />
             
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                <div style={{padding:'15px', background:'#f8fafc', borderRadius:'10px', textAlign:'center'}}>
                   <small>INGRESOS</small>
                   <div style={{fontSize:'20px', fontWeight:'bold'}}>${reporte.vTotal}</div>
                </div>
                <div style={{padding:'15px', background:'#ecfdf5', borderRadius:'10px', textAlign:'center'}}>
                   <small style={{color:'#10b981'}}>GANANCIA</small>
                   <div style={{fontSize:'20px', fontWeight:'bold', color:'#059669'}}>${reporte.ganancia}</div>
                </div>
             </div>

             <div style={{textAlign:'left'}}>
                <small style={{fontWeight:'bold'}}>DETALLE DE VENTAS:</small>
                {reporte.vnt.map((v, i) => (
                  <div key={i} style={{fontSize:'12px', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                    <b>{new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</b> - {v.productos} <span style={{float:'right'}}>${v.total}</span>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* NAVEGACIÓN INFERIOR */}
      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '8px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
        <button title="Catálogo" onClick={()=>verificarAdmin('catalogo')} style={{...estilos.btnNav, color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button title="Caja" onClick={()=>verificarAdmin('pos')} style={{...estilos.btnNav, color: vista==='pos'?'#10b981':'#94a3b8', position:'relative'}}>
          🛒 {carrito.length > 0 && <span style={{position:'absolute', top:'0', right:'0', background:'#ef4444', fontSize:'10px', color:'#fff', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}
        </button>
        <button title="Inventario" onClick={()=>verificarAdmin('admin')} style={{...estilos.btnNav, color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button title="Reportes" onClick={()=>verificarAdmin('historial')} style={{...estilos.btnNav, color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
