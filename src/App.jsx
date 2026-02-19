import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [tempUser, setTempUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234');
  const [passInput, setPassInput] = useState('');
  const [mostrandoLoginAdmin, setMostrandoLoginAdmin] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);
  
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [arqueos, setArqueos] = useState([]);

  const hoyStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }, []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);

  const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', monto: '' });
  const [efectivoCaja, setEfectivoCaja] = useState('');
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: a } = await supabase.from('arqueos').select('*').order('created_at', { ascending: false });
    if (a) setArqueos(a);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  const manejarIngreso = () => { if (tempUser.trim()) { setUsuario(tempUser); localStorage.setItem('userPacaPro', tempUser); } };
  const intentarAccesoAdmin = (v) => {
    if (['admin', 'historial'].includes(v) && !isAdmin) { setVistaPendiente(v); setMostrandoLoginAdmin(true); } 
    else { setVista(v); }
  };
  const confirmarPassword = () => {
    if (passInput === passMaestra) { setIsAdmin(true); setVista(vistaPendiente); setMostrandoLoginAdmin(false); setPassInput(''); } 
    else { alert("❌ Clave incorrecta"); setPassInput(''); }
  };

  async function registrarVenta() {
    const vTotal = carrito.reduce((a, b) => a + Number(b.precio), 0);
    const cTotal = carrito.reduce((a, b) => a + Number(b.costo_unitario), 0);
    const detalle = carrito.map(p => `${p.nombre} (${p.proveedor})`).join(', ');
    const { error } = await supabase.from('ventas').insert([{ vendedor: usuario, productos: detalle, total: vTotal, costo_total: cTotal }]);
    if (!error) {
      for (const item of carrito) { await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id); }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta Guardada");
    }
  }

  async function agregarGasto() {
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) return;
    const { error } = await supabase.from('gastos').insert([{ descripcion: nuevoGasto.descripcion, monto: Number(nuevoGasto.monto), vendedor: usuario }]);
    if (!error) { setNuevoGasto({ descripcion: '', monto: '' }); obtenerTodo(); }
  }

  async function cerrarDia() {
    if (!efectivoCaja) return alert("Ingrese efectivo");
    const vntHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === new Date().toLocaleDateString());
    const totalSistema = vntHoy.reduce((a, b) => a + b.total, 0);
    const diferencia = Number(efectivoCaja) - totalSistema;
    const { error } = await supabase.from('arqueos').insert([{ vendedor: usuario, total_ventas: totalSistema, efectivo_real: Number(efectivoCaja), diferencia }]);
    if (!error) { alert("🏁 Corte registrado"); setEfectivoCaja(''); obtenerTodo(); }
  }

  const invPorProveedor = useMemo(() => {
    const mapa = {};
    inventario.forEach(p => {
      const pr = p.proveedor || 'S/P';
      if (!mapa[pr]) mapa[pr] = { stock: 0, inversion: 0, ventaEst: 0 };
      mapa[pr].stock += (p.stock || 0);
      mapa[pr].inversion += ((p.stock || 0) * (p.costo_unitario || 0));
      mapa[pr].ventaEst += ((p.stock || 0) * (p.precio || 0));
    });
    return mapa;
  }, [inventario]);

  const statsFinales = useMemo(() => {
    const fLocal = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vntFiltradas = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fLocal);
    const gstFiltrados = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === fLocal);
    
    const ingresos = vntFiltradas.reduce((a, b) => a + b.total, 0);
    const totalGastos = gstFiltrados.reduce((a, b) => a + b.monto, 0);
    const utilidadVenta = ingresos - vntFiltradas.reduce((a, b) => a + b.costo_total, 0);

    return { vntFiltradas, gstFiltrados, ingresos, totalGastos, utilidadVenta, neto: ingresos - totalGastos };
  }, [historial, gastos, fechaConsulta]);

  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '15px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    th: { background: '#0f172a', color: '#fff', padding: '8px', fontSize: '10px', textAlign: 'left' },
    td: { padding: '8px', borderBottom: '1px solid #eee', fontSize: '11px' }
  };

  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '300px', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>PACA PRO</h2>
          <input placeholder="Vendedor" value={tempUser} onChange={e=>setTempUser(e.target.value)} style={{ ...estilos.input, textAlign: 'center', margin: '20px 0' }} />
          <button onClick={manejarIngreso} style={estilos.btn}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {mostrandoLoginAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.95)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', padding:'25px', borderRadius:'20px', width:'280px', textAlign:'center' }}>
            <h3>🔐 Admin</h3>
            <input type="password" autoFocus value={passInput} onChange={e=>setPassInput(e.target.value)} style={{...estilos.input, textAlign:'center', fontSize:'24px', letterSpacing:'4px'}} />
            <button onClick={confirmarPassword} style={{...estilos.btn, marginTop:'15px'}}>VALIDAR</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO | {isAdmin ? 'ADMIN' : 'VENTAS'}</h2>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <small style={{color:'#94a3b8'}}>{p.proveedor}</small>
                  <h4 style={{margin:'5px 0'}}>{p.nombre}</h4>
                  <div style={{fontSize:'18px', fontWeight:'900'}}>${p.precio}</div>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{...estilos.btn, background:'#0f172a', marginTop:'10px'}}>VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'historial' && isAdmin && (
          <>
            {/* TABLA INVENTARIO POR PROVEEDOR */}
            <div style={estilos.card}>
              <h3 style={{marginTop:0, fontSize:'14px'}}>📦 INVENTARIO POR PROVEEDOR</h3>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead><tr><th style={estilos.th}>Prov.</th><th style={estilos.th}>Stock</th><th style={estilos.th}>Inversión</th><th style={estilos.th}>Venta Est.</th></tr></thead>
                <tbody>
                  {Object.keys(invPorProveedor).map(p => (
                    <tr key={p}><td style={estilos.td}>{p}</td><td style={estilos.td}>{invPorProveedor[p].stock}</td><td style={estilos.td}>${invPorProveedor[p].inversion}</td><td style={estilos.td}>${invPorProveedor[p].ventaEst}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* REPORTE ECONÓMICO Y CORTE */}
            <div style={estilos.card}>
              <h3 style={{marginTop:0, fontSize:'14px'}}>📈 RESUMEN DE CORTE</h3>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'15px'}}>
                <div style={{background:'#f1f5f9', padding:'8px', borderRadius:'8px', textAlign:'center'}}><small>VENTAS</small><br/><b>${statsFinales.ingresos}</b></div>
                <div style={{background:'#fef2f2', padding:'8px', borderRadius:'8px', textAlign:'center', color:'#b91c1c'}}><small>GASTOS</small><br/><b>${statsFinales.totalGastos}</b></div>
                <div style={{background:'#ecfdf5', padding:'8px', borderRadius:'8px', textAlign:'center', color:'#059669'}}><small>NETO</small><br/><b>${statsFinales.neto}</b></div>
              </div>
            </div>

            {/* TABLA GASTOS (NUEVA) */}
            <div style={estilos.card}>
              <h3 style={{marginTop:0, fontSize:'14px'}}>💸 GASTOS</h3>
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input placeholder="Descripción" value={nuevoGasto.descripcion} onChange={e=>setNuevoGasto({...nuevoGasto, descripcion:e.target.value})} style={estilos.input} />
                <input type="number" placeholder="$" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto:e.target.value})} style={{...estilos.input, width:'80px'}} />
                <button onClick={agregarGasto} style={{...estilos.btn, width:'40px'}}>+</button>
              </div>
              <table style={{width:'100%', fontSize:'11px'}}>
                {statsFinales.gstFiltrados.map((g, i) => (
                  <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'5px'}}>{g.descripcion}</td><td style={{padding:'5px', textAlign:'right', color:'#ef4444'}}>-${g.monto}</td></tr>
                ))}
              </table>
            </div>
          </>
        )}

        {vista === 'admin' && isAdmin && (
          <div style={estilos.card}>
            <h3>⚡ CARGAR PRODUCTO</h3>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
              <input placeholder="Paca #" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
            </div>
            <input placeholder="Nombre de Prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} />
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} />
            </div>
            <button onClick={async()=>{
              await supabase.from('productos').insert([{nombre:nuevoProd.nombre, precio:Number(nuevoProd.precio), costo_unitario:Number(nuevoProd.costo), stock:Number(nuevoProd.cantidad), proveedor:infoPaca.proveedor, paca:infoPaca.numero}]);
              setNuevoProd({...nuevoProd, nombre:''}); obtenerTodo();
            }} style={estilos.btn}>GUARDAR</button>
          </div>
        )}

        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <div style={{...estilos.card, background:'#0f172a', color:'#10b981'}}>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+Number(b.precio), 0)}</h2>
              <small>TOTAL</small>
            </div>
            {carrito.length > 0 && <button onClick={registrarVenta} style={estilos.btn}>FINALIZAR VENTA</button>}

            <div style={{...estilos.card, marginTop:'40px'}}>
              <h3>🏁 CORTE DE DÍA</h3>
              <input type="number" placeholder="Efectivo real en caja" value={efectivoCaja} onChange={e=>setEfectivoCaja(e.target.value)} style={{...estilos.input, textAlign:'center', marginBottom:'10px'}} />
              <button onClick={cerrarDia} style={{...estilos.btn, background:'#6366f1'}}>CERRAR CAJA</button>
            </div>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px' }}>
        <button onClick={()=>intentarAccesoAdmin('catalogo')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button onClick={()=>intentarAccesoAdmin('pos')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='pos'?'#10b981':'#94a3b8'}}>🛒</button>
        <button onClick={()=>intentarAccesoAdmin('admin')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button onClick={()=>intentarAccesoAdmin('historial')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
