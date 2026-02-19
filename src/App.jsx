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

  // --- ESTADOS DE FILTROS GESTIÓN ---
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroPaca, setFiltroPaca] = useState('');
  const [filtroProv, setFiltroProv] = useState('');
  const [busquedaCat, setBusquedaCat] = useState('');

  // --- ESTADOS DE FORMULARIO NUEVO ---
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
    } catch (e) { console.error("Error en carga de datos:", e); }
  }

  // --- LÓGICA DE FILTRADO Y CÁLCULOS ---
  const inventarioFiltradoAdmin = useMemo(() => {
    return (inventario || []).filter(p => {
      const n = (p.nombre || '').toLowerCase().includes(filtroNombre.toLowerCase());
      const pc = (p.paca || '').toString().includes(filtroPaca);
      const pr = (p.proveedor || '').toLowerCase().includes(filtroProv.toLowerCase());
      return n && pc && pr;
    });
  }, [inventario, filtroNombre, filtroPaca, filtroProv]);

  const inventarioRealCat = useMemo(() => {
    return (inventario || []).map(p => {
      const enCar = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: (p.stock || 0) - enCar };
    });
  }, [inventario, carrito]);

  const filtradosDia = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = (historial || []).filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const gst = (gastos || []).filter(g => new Date(g.created_at).toLocaleDateString() === fFiltro);
    const tV = vnt.reduce((a, b) => a + (b.total || 0), 0);
    const tG = gst.reduce((a, b) => a + Number(b.monto || 0), 0);
    const tC = vnt.reduce((a, b) => a + (b.costo_total || 0), 0);
    return { vnt, gst, tV, tG, utilidad: tV - tC - tG };
  }, [historial, gastos, fechaConsulta]);

  const statsProveedores = useMemo(() => {
    const s = {};
    (inventario || []).forEach(p => {
      const pr = p.proveedor || 'Sin Prov';
      if (!s[pr]) s[pr] = { stock: 0, inversion: 0, venta: 0 };
      s[pr].stock += (p.stock || 0);
      s[pr].inversion += ((p.stock || 0) * (p.costo_unitario || 0));
      s[pr].venta += ((p.stock || 0) * (p.precio || 0));
    });
    return Object.entries(s);
  }, [inventario]);

  // --- ACCIONES ---
  const intentarEntrarA = (v) => {
    if ((v === 'admin' || v === 'historial') && !isAdmin) {
      setVistaPendiente(v); setMostrandoPad(true);
    } else { setVista(v); }
  };

  const validarClave = () => {
    if (passInput === CLAVE_MAESTRA) {
      setIsAdmin(true); setVista(vistaPendiente); setMostrandoPad(false); setPassInput('');
    } else { alert("❌ Clave incorrecta"); setPassInput(''); }
  };

  const actualizarInline = async (id, campo, valor) => {
    const valNum = Number(valor);
    if (isNaN(valNum)) return;
    try {
      await supabase.from('productos').update({ [campo]: valNum }).eq('id', id);
      setInventario(prev => prev.map(p => p.id === id ? { ...p, [campo]: valNum } : p));
    } catch (e) { obtenerTodo(); }
  };

  async function finalizarVenta() {
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
        if (prod) await supabase.from('productos').update({ stock: prod.stock - 1 }).eq('id', item.id);
      }
      window.open(`https://wa.me/?text=Ticket:${totalV}-Pago:${mTxt}`, '_blank');
      setCarrito([]); obtenerTodo(); setVista('catalogo');
    } catch (e) { alert("Error en venta"); }
  }

  // --- DISEÑO ---
  const cardS = { background: '#fff', padding: '15px', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' };
  const inputInline = { border: 'none', background: '#f1f5f9', borderRadius: '5px', width: '50px', textAlign: 'center', padding: '5px', fontWeight: 'bold' };

  if (!usuario) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ ...cardS, width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Nombre de Vendedor" onChange={e => setTempNombre(e.target.value)} style={inputS} />
          <button onClick={() => { if(tempNombre) { setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ ...inputS, background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '90px', fontFamily: 'system-ui' }}>
      {mostrandoPad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...cardS, width: '280px', textAlign: 'center' }}>
            <h3>🔐 Acceso Admin</h3>
            <input type="password" autoFocus style={{ ...inputS, textAlign: 'center', fontSize: '20px' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && validarClave()} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setMostrandoPad(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>X</button>
              <button onClick={validarClave} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '16px', margin: 0 }}>PACA PRO {isAdmin && "⭐"}</h1>
        <div style={{ fontSize: '12px', background: '#1e293b', padding: '5px 10px', borderRadius: '15px' }}>👤 {usuario}</div>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar en catálogo..." value={busquedaCat} onChange={e => setBusquedaCat(e.target.value)} style={inputS} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioRealCat.filter(p => p.stockActual > 0 && p.nombre?.toLowerCase().includes(busquedaCat.toLowerCase())).map(p => (
                <div key={p.id} style={cardS}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                    <span>Paca {p.paca}</span> <b>{p.stockActual} pzs</b>
                  </div>
                  <h4 style={{ margin: '8px 0', fontSize: '14px' }}>{p.nombre}</h4>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>${p.precio}</p>
                  <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={cardS}>
            <h3>🛒 Carrito ({carrito.length})</h3>
            {carrito.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{it.nombre}</span> <b>${it.precio}</b>
              </div>
            ))}
            <h2 style={{ textAlign: 'center', margin: '20px 0' }}>Total: ${carrito.reduce((a, b) => a + b.precio, 0)}</h2>
            <button onClick={finalizarVenta} style={{ ...inputS, background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '18px', padding: '15px' }}>FINALIZAR VENTA ✅</button>
          </div>
        )}

        {vista === 'admin' && (
          <>
            <div style={cardS}>
              <h3>📦 Gestión de Inventario</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                <input placeholder="🔍 Nombre..." value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} style={inputS} />
                <input placeholder="📦 # Paca..." value={filtroPaca} onChange={e => setFiltroPaca(e.target.value)} style={inputS} />
                <input placeholder="🏢 Proveedor..." value={filtroProv} onChange={e => setFiltroProv(e.target.value)} style={{ ...inputS, gridColumn: 'span 2' }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Producto</th>
                      <th style={{ padding: '8px' }}>Paca</th>
                      <th style={{ padding: '8px' }}>Precio</th>
                      <th style={{ padding: '8px' }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventarioFiltradoAdmin.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', textAlign: 'left' }}>
                          <b>{p.nombre}</b><br/>
                          <small style={{ color: '#94a3b8' }}>{p.proveedor}</small>
                        </td>
                        <td style={{ padding: '8px' }}>{p.paca}</td>
                        <td style={{ padding: '8px' }}>
                          <input type="number" defaultValue={p.precio} onBlur={e => actualizarInline(p.id, 'precio', e.target.value)} style={inputInline} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input type="number" defaultValue={p.stock} onBlur={e => actualizarInline(p.id, 'stock', e.target.value)} style={inputInline} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardS}>
              <h3>🏢 Tabla de Proveedores</h3>
              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left' }}>
                <thead><tr style={{ color: '#64748b' }}><th>Proveedor</th><th>Stock</th><th>Inv. Total</th></tr></thead>
                <tbody>
                  {statsProveedores.map(([n, s]) => (
                    <tr key={n} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0' }}>{n}</td>
                      <td>{s.stock} pzs</td>
                      <td>${s.inversion.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'historial' && (
          <div style={cardS}>
            <h3>📈 Reporte Diario</h3>
            <input type="date" value={fechaConsulta} onChange={e => setFechaConsulta(e.target.value)} style={inputS} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
              <div style={{ background: '#f1f5f9', padding: '15px', borderRadius: '10px' }}>
                <small>Ventas</small><h3>${filtradosDia.tV}</h3>
              </div>
              <div style={{ background: '#f1f5f9', padding: '15px', borderRadius: '10px' }}>
                <small>Gastos</small><h3>${filtradosDia.tG}</h3>
              </div>
            </div>
            <h2 style={{ textAlign: 'center', color: '#10b981', margin: '20px 0' }}>Utilidad: ${filtradosDia.utilidad}</h2>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <button onClick={() => intentarEntrarA('catalogo')} style={{ background: vista === 'catalogo' ? '#1e293b' : 'none', border: 'none', fontSize: '24px', borderRadius: '12px', padding: '8px' }}>📦</button>
        <button onClick={() => intentarEntrarA('pos')} style={{ background: vista === 'pos' ? '#1e293b' : 'none', border: 'none', fontSize: '24px', borderRadius: '12px', padding: '8px', position: 'relative' }}>
          🛒 {carrito.length > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{carrito.length}</span>}
        </button>
        <button onClick={() => intentarEntrarA('admin')} style={{ background: vista === 'admin' ? '#1e293b' : 'none', border: 'none', fontSize: '24px', borderRadius: '12px', padding: '8px', opacity: isAdmin ? 1 : 0.5 }}>⚡</button>
        <button onClick={() => intentarEntrarA('historial')} style={{ background: vista === 'historial' ? '#1e293b' : 'none', border: 'none', fontSize: '24px', borderRadius: '12px', padding: '8px', opacity: isAdmin ? 1 : 0.5 }}>📈</button>
      </nav>
    </div>
  );
}
