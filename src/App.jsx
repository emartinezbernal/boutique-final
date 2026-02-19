import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

// --- CONFIGURACIÓN DE SEGURIDAD ---
const CLAVE_MAESTRA = "1234";

export default function App() {
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');
  
  // Estados de Seguridad
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrandoPad, setMostrandoPad] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [vistaPendiente, setVistaPendiente] = useState(null);

  const [inventario, setInventario] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  
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

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  // --- LÓGICA DE ACCESO SEGURO ---
  const manejarLogin = () => {
    if (tempNombre.trim()) {
      setUsuario(tempNombre.trim());
      localStorage.setItem('pacaUser', tempNombre.trim());
    }
  };

  const intentarEntrarA = (v) => {
    if ((v === 'estadisticas' || v === 'admin') && !isAdmin) {
      setVistaPendiente(v);
      setMostrandoPad(true);
    } else {
      setVista(v);
    }
  };

  const validarClave = () => {
    if (passInput === CLAVE_MAESTRA) {
      setIsAdmin(true);
      setVista(vistaPendiente);
      setMostrandoPad(false);
      setPassInput('');
    } else {
      alert("❌ Clave incorrecta");
      setPassInput('');
    }
  };

  // --- OPERACIONES ---
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
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }
  };

  if (!usuario) {
    return (
      <div style={{ background: '#1a1a1a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ ...estilos.card, width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h2>PACA PRO</h2>
          <input placeholder="Nombre Vendedor" style={estilos.input} value={tempNombre} onChange={(e) => setTempNombre(e.target.value)} />
          <button onClick={manejarLogin} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui' }}>
      
      {/* MODAL CLAVE MAESTRA */}
      {mostrandoPad && (
        <div style={estilos.modal}>
          <div style={{ ...estilos.card, width: '280px', textAlign: 'center' }}>
            <h3>🔐 Acceso Admin</h3>
            <input 
              type="password" 
              autoFocus
              placeholder="••••" 
              style={{ ...estilos.input, fontSize: '24px', textAlign: 'center', letterSpacing: '8px' }} 
              value={passInput} 
              onChange={e => setPassInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && validarClave()}
            />
            <button onClick={validarClave} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff' }}>VALIDAR</button>
            <button onClick={() => setMostrandoPad(false)} style={{ background: 'none', border: 'none', color: 'red', marginTop: '10px' }}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#1a1a1a', color: '#fff', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '16px' }}>PACA PRO {isAdmin && "⭐"}</h2>
        <span style={{ fontSize: '12px' }}>👤 {usuario}</span>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '15px' }}>
        
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." style={estilos.input} onChange={(e) => setBusqueda(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <small style={{ color: '#888' }}>{p.proveedor}</small>
                  <h4 style={{ margin: '5px 0' }}>{p.nombre}</h4>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2ecc71' }}>${p.precio}</div>
                  <button onClick={() => setCarrito([...carrito, p])} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff', fontSize: '12px' }}>VENDER</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'estadisticas' && (
          <>
            <div style={estilos.card}>
              <h3>📊 Inventario por Proveedor</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th>Prov.</th><th>Stock</th><th>Inversión</th><th>Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(invPorProveedor).map(prov => (
                    <tr key={prov} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0' }}>{prov}</td>
                      <td>{invPorProveedor[prov].stock}</td>
                      <td>${invPorProveedor[prov].inversion}</td>
                      <td>${invPorProveedor[prov].ventaEst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={estilos.card}>
              <h3>📉 Resumen Financiero</h3>
              <input type="date" value={fechaConsulta} onChange={(e) => setFechaConsulta(e.target.value)} style={estilos.input} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', textAlign: 'center' }}>
                <div style={{ background: '#e8f5e9', padding: '8px', borderRadius: '10px' }}><small>Venta</small><br/><b>${stats.ingresos}</b></div>
                <div style={{ background: '#ffebee', padding: '8px', borderRadius: '10px' }}><small>Gasto</small><br/><b>${stats.egresos}</b></div>
                <div style={{ background: '#e3f2fd', padding: '8px', borderRadius: '10px' }}><small>Caja</small><br/><b>${stats.netoEfectivo}</b></div>
              </div>
            </div>

            <div style={estilos.card}>
              <h3>💸 Gastos</h3>
              <input placeholder="Descripción" value={nuevoGasto.descripcion} onChange={e=>setNuevoGasto({...nuevoGasto, descripcion:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Monto" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto:e.target.value})} style={estilos.input} />
              <button onClick={async () => {
                  await supabase.from('gastos').insert([{ ...nuevoGasto, monto: Number(nuevoGasto.monto), vendedor: usuario }]);
                  setNuevoGasto({ descripcion: '', monto: '' }); obtenerTodo();
                }} style={{ ...estilos.btn, background: '#e74c3c', color: '#fff' }}>REGISTRAR GASTO</button>
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...estilos.card, background: '#1a1a1a', color: '#fff' }}>
              <h2 style={{ fontSize: '40px', margin: 0 }}>${carrito.reduce((a, b) => a + b.precio, 0)}</h2>
            </div>
            {carrito.length > 0 && <button onClick={registrarVenta} style={{ ...estilos.btn, background: '#2ecc71', color: '#fff' }}>FINALIZAR VENTA</button>}

            <div style={{ ...estilos.card, marginTop: '30px' }}>
              <h3>🏁 Corte de Caja</h3>
              <input type="number" placeholder="Efectivo en caja" value={efectivoCaja} onChange={(e) => setEfectivoCaja(e.target.value)} style={{ ...estilos.input, textAlign: 'center' }} />
              <button onClick={async () => {
                  const dif = Number(efectivoCaja) - stats.ingresos;
                  await supabase.from('arqueos').insert([{ total_ventas: stats.ingresos, efectivo_real: Number(efectivoCaja), diferencia: dif, vendedor: usuario }]);
                  alert("Arqueo guardado"); setEfectivoCaja(''); obtenerTodo();
                }} style={{ ...estilos.btn, background: '#3498db', color: '#fff' }}>GUARDAR CORTE</button>
            </div>
          </div>
        )}

        {vista === 'admin' && (
          <div style={estilos.card}>
            <h3>📦 Nuevo Producto</h3>
            <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor:e.target.value})} style={estilos.input} />
            <input placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre:e.target.value})} style={estilos.input} />
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio:e.target.value})} style={estilos.input} />
              <input type="number" placeholder="Stock" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad:e.target.value})} style={estilos.input} />
            </div>
            <button onClick={async () => {
                await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), proveedor: infoPaca.proveedor }]);
                setNuevoProd({ ...nuevoProd, nombre: '' }); obtenerTodo();
              }} style={{ ...estilos.btn, background: '#1a1a1a', color: '#fff' }}>GUARDAR</button>
          </div>
        )}

      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid #eee' }}>
        <button onClick={() => intentarEntrarA('catalogo')} style={{ background: 'none', border: 'none', fontSize: '24px', opacity: vista === 'catalogo' ? 1 : 0.4 }}>📦</button>
        <button onClick={() => intentarEntrarA('pos')} style={{ background: 'none', border: 'none', fontSize: '24px', opacity: vista === 'pos' ? 1 : 0.4 }}>🛒</button>
        <button onClick={() => intentarEntrarA('estadisticas')} style={{ background: 'none', border: 'none', fontSize: '24px', opacity: vista === 'estadisticas' ? 1 : 0.4 }}>📈</button>
        <button onClick={() => intentarEntrarA('admin')} style={{ background: 'none', border: 'none', fontSize: '24px', opacity: vista === 'admin' ? 1 : 0.4 }}>⚙️</button>
      </nav>
    </div>
  );
}
