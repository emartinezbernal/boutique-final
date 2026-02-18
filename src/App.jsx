import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState('hoy');
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // LÓGICA DE FILTRADO Y GANANCIAS (VER 9.5)
  const ventasFiltradas = historial.filter(v => {
    const fechaVenta = new Date(v.created_at);
    const hoy = new Date();
    if (filtroFecha === 'hoy') return fechaVenta.toLocaleDateString() === hoy.toLocaleDateString();
    if (filtroFecha === 'ayer') {
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      return fechaVenta.toLocaleDateString() === ayer.toLocaleDateString();
    }
    if (filtroFecha === 'semana') {
      const semana = new Date(); semana.setDate(hoy.getDate() - 7);
      return fechaVenta >= semana;
    }
    return true;
  });

  const totalVendido = ventasFiltradas.reduce((a, b) => a + (b.total || 0), 0);
  const totalCosto = ventasFiltradas.reduce((a, b) => a + (b.costo_total || 0), 0);
  const gananciaNeta = totalVendido - totalCosto;

  // REGISTRO CON ALERTA DE MARGEN (VER 9.6)
  async function guardarInventario(e) {
    e.preventDefault();
    const cant = parseInt(nuevoProd.cantidad);
    const costo = parseFloat(nuevoProd.costo) || 0;
    const precio = parseFloat(nuevoProd.precio) || 0;

    if (precio <= costo) {
      if (!confirm("⚠️ ¡ALERTA!: El precio de venta no genera ganancia (es menor o igual al costo). ¿Deseas registrarlo de todos modos?")) return;
    }

    const { data: ex } = await supabase.from('productos').select('*').eq('nombre', nuevoProd.nombre).eq('precio', precio).maybeSingle();

    if (ex) {
      await supabase.from('productos').update({ stock: (ex.stock || 0) + cant, costo_unitario: costo }).eq('id', ex.id);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio, costo_unitario: costo, stock: cant }]);
    }
    setNuevoProd({ nombre: '', precio: '', costo: '', cantidad: 1 });
    obtenerTodo();
    alert("📦 Inventario actualizado con éxito");
  }

  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        if (data && data.stock > 0) await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]); obtenerTodo(); setVista('historial');
      alert("✅ Venta cobrada. ¡Buen trabajo!");
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '100px' }}>
      
      <header style={{ backgroundColor: '#0f172a', padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: '900', borderBottom: '2px solid #10b981' }}>
        PACA PRO v9.6 <span style={{color:'white'}}>| GANANCIAS</span>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* PESTAÑA 📈: REPORTES Y GANANCIA NETA */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              {['hoy', 'ayer', 'semana'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : '#fff', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>{f.toUpperCase()}</button>
              ))}
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{color: '#64748b'}}>Ingresos:</span>
                <span style={{fontWeight: 'bold'}}>${totalVendido}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{color: '#64748b'}}>Inversión (Costos):</span>
                <span style={{fontWeight: 'bold', color: '#ef4444'}}>- ${totalCosto}</span>
              </div>
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '2px dashed #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{fontWeight: 'bold', fontSize: '14px'}}>GANANCIA NETA:</span>
                <span style={{fontWeight: '900', color: '#10b981', fontSize: '24px'}}>${gananciaNeta}</span>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA ➕: ALTA CON PROTECCIÓN DE MARGEN */}
        {vista === 'admin' && (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#0f172a' }}>Registrar Nueva Paca</h3>
            <form onSubmit={guardarInventario}>
              <input type="text" placeholder="Descripción (Ej: Playera Nike)" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} required />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Costo Unitario ($)</label>
                  <input type="number" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} required />
                </div>
                <div>
                  <label style={{fontSize: '11px', color: '#64748b'}}>Precio Venta ($)</label>
                  <input type="number" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} required />
                </div>
              </div>

              <label style={{fontSize: '11px', color: '#64748b'}}>Cantidad de Piezas</label>
              <input type="number" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} required />
              
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>CARGAR INVENTARIO</button>
            </form>
          </div>
        )}

        {/* PESTAÑA 📦: CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar en inventario..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', marginBottom: '15px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ background: '#fff', padding: '15px', borderRadius: '18px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{p.nombre}</p>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>Stock: {p.stock}</span>
                  <p style={{ color: '#0f172a', fontSize: '22px', fontWeight: '900', margin: '10px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>VENDER</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 🛒: CARRITO CON MARGEN INDIVIDUAL */}
        {vista === 'pos' && (
          <div>
            <div style={{ background: '#0f172a', color: '#fff', padding: '25px', borderRadius: '20px', textAlign: 'center', marginBottom: '15px' }}>
              <p style={{margin: 0, opacity: 0.6, fontSize: '12px'}}>TOTAL TICKET</p>
              <h2 style={{ fontSize: '42px', margin: 0, color: '#10b981' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ background: '#fff', padding: '15px', marginBottom: '8px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', borderLeft: (item.precio <= item.costo_unitario) ? '5px solid #ef4444' : '5px solid #10b981' }}>
                <div>
                  <p style={{margin:0, fontWeight:'bold'}}>{item.nombre}</p>
                  <p style={{margin:0, fontSize:'11px', color: (item.precio > item.costo_unitario ? '#10b981' : '#ef4444')}}>
                    Ganancia: ${(item.precio - item.costo_unitario).toFixed(2)}
                  </p>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <span style={{fontWeight:'bold'}}>${item.precio}</span>
                  <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{color:'#ef4444', border:'none', background:'none', fontSize:'18px', cursor:'pointer'}}>✕</button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{ width: '100%', padding: '18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '18px', marginTop: '10px', cursor:'pointer' }}>COBRAR Y FINALIZAR ✅</button>}
          </div>
        )}
      </main>

      {/* NAVEGACIÓN INFERIOR */}
      <nav style={{ position: 'fixed', bottom: '0', width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '15px', borderTop: '1px solid #e2e8f0', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background:'none', fontSize:'24px', cursor:'pointer', position:'relative' }}>
          🛒 {carrito.length > 0 && <span style={{position:'absolute', top:'-5px', right:'-5px', background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}
        </button>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background:'none', fontSize:'24px', cursor:'pointer' }}>📦</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background:'none', fontSize:'24px', cursor:'pointer' }}>➕</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background:'none', fontSize:'24px', cursor:'pointer' }}>📈</button>
      </nav>
    </div>
  );
}
