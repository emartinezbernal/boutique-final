import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const CLAVE_MAESTRA = "1234";

export default function App() {
  // --- ESTADOS DE SESIÓN Y VISTAS ---
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrandoPad, setMostrandoPad] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [vistaPendiente, setVistaPendiente] = useState(null);
  const [vista, setVista] = useState('catalogo');

  // --- ESTADOS DE DATOS ---
  const [inventario, setInventario] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);

  // --- ESTADOS DE FILTROS ---
  const [busquedaCat, setBusquedaCat] = useState('');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroPaca, setFiltroPaca] = useState('');
  const [filtroProv, setFiltroProv] = useState('');

  // --- ESTADOS DE FORMULARIO ---
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
  const inputNombreRef = useRef(null);

  const obtenerFechaLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const hoyStr = useMemo(() => obtenerFechaLocal(), []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);

  useEffect(() => {
    const c = localStorage.getItem('cortesPacaPro');
    if (c) setCortes(JSON.parse(c));
  }, []);

  useEffect(() => {
    if (usuario) obtenerTodo();
  }, [usuario]);

  async function obtenerTodo() {
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (p) setInventario(p);
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      if (v) setHistorial(v);
      const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
      if (g) setGastos(g);
    } catch (e) { console.error("Error carga:", e); }
  }

  // --- LÓGICA DE FILTRADO ---
  const inventarioFiltradoAdmin = useMemo(() => {
    return (inventario || []).filter(p => {
      const matchNom = (p.nombre || '').toLowerCase().includes(filtroNombre.toLowerCase());
      const matchPaca = (p.paca || '').toString().includes(filtroPaca);
      const matchProv = (p.proveedor || '').toLowerCase().includes(filtroProv.toLowerCase());
      return matchNom && matchPaca && matchProv;
    });
  }, [inventario, filtroNombre, filtroPaca, filtroProv]);

  const inventarioRealCat = useMemo(() => {
    return (inventario || []).map(p => {
      const enCar = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: (p.stock || 0) - enCar };
    });
  }, [inventario, carrito]);

  const statsProveedores = useMemo(() => {
    const s = {};
    (inventario || []).forEach(p => {
      const pr = p.proveedor || 'S/P';
      if (!s[pr]) s[pr] = { stock: 0, inversion: 0, venta: 0 };
      s[pr].stock += (p.stock || 0);
      s[pr].inversion += (p.stock * p.costo_unitario || 0);
      s[pr].venta += (p.stock * p.precio || 0);
    });
    return Object.entries(s);
  }, [inventario]);

  const filtradosDia = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = (historial || []).filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const gst = (gastos || []).filter(g => new Date(g.created_at).toLocaleDateString() === fFiltro);
    const tV = vnt.reduce((a, b) => a + (b.total || 0), 0);
    const tG = gst.reduce((a, b) => a + Number(b.monto || 0), 0);
    const tC = vnt.reduce((a, b) => a + (b.costo_total || 0), 0);
    return { vnt, gst, tV, tG, utilidad: tV - tC - tG };
  }, [historial, gastos, fechaConsulta]);

  // --- ACCIONES ---
  const intentarEntrarA = (v) => {
    if ((v === 'admin' || v === 'historial') && !isAdmin) {
      setVistaPendiente(v); setMostrandoPad(true);
    } else { setVista(v); }
  };

  const validarClave = () => {
    if (passInput === CLAVE_MAESTRA) {
      setIsAdmin(true); setVista(vistaPendiente); setMostrandoPad(false); setPassInput('');
    } else { alert("Clave incorrecta"); setPassInput(''); }
  };

  const actualizarInline = async (id, campo, valor) => {
    const val = Number(valor);
    if (isNaN(val)) return;
    try {
      await supabase.from('productos').update({ [campo]: val }).eq('id', id);
      setInventario(prev => prev.map(p => p.id === id ? { ...p, [campo]: val } : p));
    } catch (e) { obtenerTodo(); }
  };

  async function vender() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    const mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const totalV = carrito.reduce((a, b) => a + b.precio, 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    try {
      await supabase.from('ventas').insert([{ total: totalV, costo_total: costoV, vendedor: usuario, detalles: mTxt }]);
      for (const item of carrito) {
        const prod = inventario.find(p => p.id === item.id);
        await supabase.from('productos').update({ stock: prod.stock - 1 }).eq('id', item.id);
      }
      window.open(`https://wa.me/?text=Venta:${totalV}-Pago:${mTxt}`, '_blank');
      setCarrito([]); obtenerTodo(); setVista('catalogo');
    } catch (e) { alert("Error"); }
  }

  // --- ESTILOS ---
  const cardS = { background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '10px' };
  const inputS = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '8px', fontSize: '14px' };
  const tabS = { width: '100%', fontSize: '11px', borderCollapse: 'collapse' };
  const thS = { borderBottom: '2px solid #eee', padding: '8px', color: '#666' };

  if (!usuario) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ ...cardS, width: '100%', maxWidth: '300px', textAlign: 'center' }}>
          <h3>📦 PACA PRO</h3>
          <input placeholder="Nombre" onChange={e => setTempNombre(e.target.value)} style={inputS} />
          <button onClick={() => { if(tempNombre) { setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ ...inputS, background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '80px', fontFamily: 'sans-serif' }}>
      {mostrandoPad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zInter: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...cardS, width: '250px' }}>
            <input type="password" autoFocus style={{ ...inputS, textAlign: 'center' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && validarClave()} />
            <button onClick={validarClave} style={{ ...inputS, background: '#10b981', color: '#fff' }}>OK</button>
            <button onClick={() => setMostrandoPad(false)} style={{ ...inputS, background: '#eee' }}>Cerrar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <b>PACA PRO {isAdmin && "⭐"}</b>
        <small>👤 {usuario}</small>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busquedaCat} onChange={e => setBusquedaCat(e.target.value)} style={inputS} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioRealCat.filter(p => p.stockActual > 0 && p.nombre?.toLowerCase().includes(busquedaCat.toLowerCase())).map(p => (
                <div key={p.id} style={cardS}>
                  <small style={{ color: '#888' }}>Paca {p.paca} | {p.stockActual} pzs</small>
                  <h4 style={{ margin: '5px 0' }}>{p.nombre}</h4>
                  <b style={{ fontSize: '18px' }}>${p.precio}</b>
                  <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', background: '#0f172a', color: '#10b981', padding: '8px', border: 'none', borderRadius: '5px', marginTop: '10px' }}>+ Carrito</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={cardS}>
            <h3>🛒 Carrito ({carrito.length})</h3>
            {carrito.map((it, idx) => <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>{it.nombre} - <b>${it.precio}</b></div>)}
            <h2 style={{ textAlign: 'right' }}>Total: ${carrito.reduce((a, b) => a + b.precio, 0)}</h2>
            <button onClick={vender} style={{ ...inputS, background: '#10b981', color: '#fff', fontSize: '18px', padding: '15px' }}>FINALIZAR VENTA</button>
          </div>
        )}

        {vista === 'admin' && (
          <>
            <div style={cardS}>
              <h3>⚡ Gestión de Inventario</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '15px' }}>
                <input placeholder="Filtro Nombre" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} style={inputS} />
                <input placeholder="Filtro Paca" value={filtroPaca} onChange={e => setFiltroPaca(e.target.value)} style={inputS} />
                <input placeholder="Filtro Proveedor" value={filtroProv} onChange={e => setFiltroProv(e.target.value)} style={{ ...inputS, gridColumn: 'span 2' }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={tabS}>
                  <thead><tr><th style={thS}>Producto</th><th style={thS}>$</th><th style={thS}>Stock</th></tr></thead>
                  <tbody>
                    {inventarioFiltradoAdmin.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{p.nombre}<br/><small style={{color:'#aaa'}}>P:{p.paca} | {p.proveedor}</small></td>
                        <td><input type="number" defaultValue={p.precio} onBlur={e => actualizarInline(p.id, 'precio', e.target.value)} style={{ width: '50px', border: 'none', background: '#f0f0f0', textAlign: 'center' }} /></td>
                        <td><input type="number" defaultValue={p.stock} onBlur={e => actualizarInline(p.id, 'stock', e.target.value)} style={{ width: '40px', border: 'none', background: '#f0f0f0', textAlign: 'center' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={cardS}>
              <h3>🏢 Proveedores</h3>
              <table style={tabS}>
                <thead><tr><th style={thS}>Nombre</th><th style={thS}>Stock</th><th style={thS}>Inv.</th></tr></thead>
                <tbody>
                  {statsProveedores.map(([n, s]) => (
                    <tr key={n}><td>{n}</td><td>{s.stock}</td><td>${s.inversion}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'historial' && (
          <div style={cardS}>
            <h3>📈 Reporte de Hoy</h3>
            <p>Ventas: <b>${filtradosDia.tV}</b></p>
            <p>Gastos: <b>${filtradosDia.tG}</b></p>
            <h2 style={{ color: '#10b981' }}>Caja: ${filtradosDia.tV - filtradosDia.tG}</h2>
            <hr/>
            <button onClick={() => {
               const f = window.prompt("Efectivo físico?");
               const corte = { id: Date.now(), vendedor: usuario, físico: f, ventas: filtradosDia.tV };
               setCortes([corte, ...cortes]);
               localStorage.setItem('cortesPacaPro', JSON.stringify([corte, ...cortes]));
            }} style={{ ...inputS, background: '#0f172a', color: '#fff' }}>Hacer Corte</button>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '15px' }}>
        <button onClick={() => intentarEntrarA('catalogo')} style={{ background: 'none', border: 'none', fontSize: '20px' }}>📦</button>
        <button onClick={() => intentarEntrarA('pos')} style={{ background: 'none', border: 'none', fontSize: '20px' }}>🛒</button>
        <button onClick={() => intentarEntrarA('admin')} style={{ background: 'none', border: 'none', fontSize: '20px' }}>⚡</button>
        <button onClick={() => intentarEntrarA('historial')} style={{ background: 'none', border: 'none', fontSize: '20px' }}>📈</button>
      </nav>
    </div>
  );
}
