import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- SISTEMA DE LOGIN (NUEVO) ---
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');

  // --- ESTADOS ORIGINALES v14.6 ---
  const [inventario, setInventario] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
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

  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', monto: '' });
  const [efectivoCaja, setEfectivoCaja] = useState('');
  const inputNombreRef = useRef(null);

  useEffect(() => {
    if (usuario) obtenerTodo();
  }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
    const { data: a } = await supabase.from('arqueos').select('*').order('created_at', { ascending: false });
    if (a) setArqueos(a);
  }

  // --- ACCIÓN DE LOGIN ---
  const manejarLogin = () => {
    if (tempNombre.trim()) {
      setUsuario(tempNombre.trim());
      localStorage.setItem('pacaUser', tempNombre.trim());
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('pacaUser');
    setUsuario('');
  };

  // --- LÓGICA DE VENTAS (Actualizada con usuario) ---
  async function registrarVenta() {
    const totalVenta = carrito.reduce((a, b) => a + b.precio, 0);
    const costoTotal = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalle = carrito.map(p => `${p.nombre} (${p.proveedor || 'S/P'})`).join(', ');

    const { error } = await supabase.from('ventas').insert([
      { productos: detalle, total: totalVenta, costo_total: costoTotal, vendedor: usuario }
    ]);

    if (!error) {
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta Guardada");
    }
  }

  // --- CÁLCULOS ---
  const stats = useMemo(() => {
    const fLocal = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vntDia = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fLocal);
    const gstDia = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === fLocal);
    const ingresos = vntDia.reduce((a, b) => a + b.total, 0);
    const egresos = gstDia.reduce((a, b) => a + b.monto, 0);
    return { ingresos, egresos, netoEfectivo: ingresos - egresos, vntDia, gstDia };
  }, [historial, gastos, fechaConsulta]);

  const invPorProveedor = useMemo(() => {
    const resumen = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'Sin Proveedor';
      if (!resumen[prov]) resumen[prov] = { stock: 0, inversion: 0, ventaEst: 0 };
      resumen[prov].stock += p.stock;
      resumen[prov].inversion += (p.stock * (p.costo_unitario || 0));
      resumen[prov].ventaEst += (p.stock * p.precio);
    });
    return resumen;
  }, [inventario]);

  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '15px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '10px', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' },
    loginBg: { background: '#1a1a1a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }
  };

  // --- PANTALLA DE LOGIN ---
  if (!usuario) {
    return (
      <div style={estilos.loginBg}>
        <div style={{ ...estilos.card, width: '100%', maxWidth: '350px', textAlign: 'center', padding: '40px 20px' }}>
          <h1 style={{ margin: 0, color: '#1a1a1a' }}>PACA PRO</h1>
          <p style={{ color: '#888', marginBottom: '30px' }}>Bienvenido, identifica tu sesión</p>
          <input 
            placeholder="Tu nombre o usuario" 
            style={{ ...estilos.input, textAlign: 'center' }} 
            value={tempNombre} 
            onChange={(e) => setTempNombre(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && manejarLogin()}
          />
          <button onClick={manejarLogin} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff' }}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui' }}>
      
      <header style={{ background: '#1a1a1a', color: '#fff', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '16px' }}>PACA PRO</h2>
        <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>👤 {usuario}</span>
          <button onClick={cerrarSesion} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '5px', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '15px' }}>
        
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." style={estilos.input} onChange={(e) => setBusqueda(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <small style={{ color: '#888' }}>{p.proveedor}</small>
                  <h4 style={{ margin: '5px 0' }}>{p.nombre}</h4>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2ecc71' }}>${p.precio}</div>
                  <button onClick={() => setCarrito([...carrito, p])} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff', marginTop: '10px', fontSize: '12px' }}> + AGREGAR </button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'estadisticas' && (
          <>
            <div style={estilos.card}>
              <h3 style={{ marginTop: 0 }}>📊 Inventario por Proveedor</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: '11px', paddingBottom: '10px' }}>Prov.</th>
                    <th style={{ fontSize: '11px' }}>Stock</th>
                    <th style={{ fontSize: '11px' }}>Inversión</th>
                    <th style={{ fontSize: '11px' }}>Venta Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(invPorProveedor).map(prov => (
                    <tr key={prov} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{ padding: '8px 0', fontSize: '12px' }}>{prov}</td>
                      <td style={{ textAlign: 'center', fontSize: '12px' }}>{invPorProveedor[prov].stock}</td>
                      <td style={{ textAlign: 'center', fontSize: '12px' }}>${invPorProveedor[prov].inversion}</td>
                      <td style={{ textAlign: 'center', fontSize: '12px' }}>${invPorProveedor[prov].ventaEst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={estilos.card}>
              <h3>📉 Finanzas</h3>
              <input type="date" value={fechaConsulta} onChange={(e) => setFechaConsulta(e.target.value)} style={estilos.input} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: '#e8f5e9', padding: '8px', borderRadius: '10px' }}><small>Venta</small><br/><b>${stats.ingresos}</b></div>
                <div style={{ background: '#ffebee', padding: '8px', borderRadius: '10px' }}><small>Gasto</small><br/><b>${stats.egresos}</b></div>
                <div style={{ background: '#e3f2fd', padding: '8px', borderRadius: '10px' }}><small>Caja</small><br/><b>${stats.netoEfectivo}</b></div>
              </div>
            </div>

            <div style={estilos.card}>
              <h3>💸 Registrar Gasto</h3>
              <input placeholder="Descripción" value={nuevoGasto.descripcion} onChange={e=>setNuevoGasto({...nuevoGasto, descripcion:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Monto $" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto:e.target.value})} style={estilos.input} />
              <button onClick={async () => {
                  await supabase.from('gastos').insert([{ ...nuevoGasto, monto: Number(nuevoGasto.monto), vendedor: usuario }]);
                  setNuevoGasto({ descripcion: '', monto: '' }); obtenerTodo();
                }} style={{ ...estilos.btn, background: '#e74c3c', color: '#fff' }}> GUARDAR GASTO </button>
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...estilos.card, background: '#1a1a1a', color: '#fff' }}>
              <h2 style={{ fontSize: '40px', margin: 0 }}>${carrito.reduce((a, b) => a + b.precio, 0)}</h2>
            </div>
            {carrito.length > 0 && (
              <button onClick={registrarVenta} style={{ ...estilos.btn, background: '#2ecc71', color: '#fff', padding: '15px', fontSize: '18px' }}> FINALIZAR VENTA </button>
            )}

            <div style={{ ...estilos.card, marginTop: '30px' }}>
              <h3>🏁 Corte de Caja</h3>
              <input type="number" placeholder="Efectivo real en caja" value={efectivoCaja} onChange={(e) => setEfectivoCaja(e.target.value)} style={{ ...estilos.input, textAlign: 'center' }} />
              <button onClick={async () => {
                  const dif = Number(efectivoCaja) - stats.ingresos;
                  await supabase.from('arqueos').insert([{ total_ventas: stats.ingresos, efectivo_real: Number(efectivoCaja), diferencia: dif, vendedor: usuario }]);
                  alert(`Corte guardado. Diferencia: $${dif}`);
                  setEfectivoCaja(''); obtenerTodo();
                }} style={{ ...estilos.btn, background: '#3498db', color: '#fff' }}> REGISTRAR ARQUEO </button>
            </div>
          </div>
        )}

        {vista === 'admin' && (
          <div style={estilos.card}>
            <h3>📦 Carga de Inventario</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input placeholder="Paca #" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero:e.target.value})} style={estilos.input} />
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor:e.target.value})} style={estilos.input} />
            </div>
            <input ref={inputNombreRef} placeholder="Nombre del Producto" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre:e.target.value})} style={estilos.input} />
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad:e.target.value})} style={estilos.input} />
            </div>
            <button onClick={async () => {
                await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), proveedor: infoPaca.proveedor, paca: infoPaca.numero }]);
                setNuevoProd({ ...nuevoProd, nombre: '' }); obtenerTodo();
              }} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff' }}> GUARDAR PRODUCTO </button>
          </div>
        )}

      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid #ddd' }}>
        <button onClick={() => setVista('catalogo')} style={{ background: 'none', border: 'none', fontSize: '20px', opacity: vista === 'catalogo' ? 1 : 0.4 }}>📦</button>
        <button onClick={() => setVista('pos')} style={{ background: 'none', border: 'none', fontSize: '20px', opacity: vista === 'pos' ? 1 : 0.4 }}>🛒</button>
        <button onClick={() => setVista('estadisticas')} style={{ background: 'none', border: 'none', fontSize: '20px', opacity: vista === 'estadisticas' ? 1 : 0.4 }}>📈</button>
        <button onClick={() => setVista('admin')} style={{ background: 'none', border: 'none', fontSize: '20px', opacity: vista === 'admin' ? 1 : 0.4 }}>⚙️</button>
      </nav>
    </div>
  );
}
