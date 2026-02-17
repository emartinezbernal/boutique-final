import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

// ESTILO DE BOTÓN INTERACTIVO GLOBAL
const btnStyle = {
  transition: 'all 0.1s ease',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none'
};

// Función para el efecto de clic (se activa con CSS inline)
const activeEffect = "this.style.transform='scale(0.95)'; this.style.filter='brightness(0.9)'";
const normalEffect = "this.style.transform='scale(1)'; this.style.filter='brightness(1)'";

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', codigo: '' });
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => { obtenerTodo(); }, []);

  useEffect(() => {
    if (escaneando) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        if (vista === 'admin') {
          setNuevoProd(prev => ({ ...prev, codigo: decodedText }));
        } else {
          buscarPorCodigo(decodedText);
        }
        setEscaneando(false);
        scanner.clear();
      }, () => {});
      return () => scanner.clear();
    }
  }, [escaneando]);

  async function obtenerTodo() {
    const resProd = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resProd.data) setInventario(resProd.data);
    const resVent = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resVent.data) setHistorial(resVent.data);
  }

  async function buscarPorCodigo(codigo) {
    const { data } = await supabase.from('productos').select('*').eq('codigo_barras', codigo).single();
    if (data) {
      setCarrito(prev => [...prev, data]);
      // FEEDBACK VISUAL RÁPIDO
    } else { alert("❌ No encontrado"); }
  }

  const inventarioFiltrado = inventario.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.includes(busqueda))
  );

  async function guardarEnBD(e) {
    e.preventDefault();
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    if(!error) {
      setNuevoProd({ nombre: '', precio: '', codigo: '' });
      obtenerTodo();
      setVista('catalogo');
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      
      {/* CABECERA */}
      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v5.1</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* ESCÁNER */}
        {escaneando && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 100, padding: '20px' }}>
            <div id="reader" style={{ backgroundColor: '#fff', borderRadius: '20px', overflow: 'hidden' }}></div>
            <button 
              onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
              onClick={() => setEscaneando(false)} 
              style={{ ...btnStyle, width: '100%', marginTop: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '15px', fontWeight: 'bold', color: '#000' }}>
              CANCELAR
            </button>
          </div>
        )}

        {/* VISTA: INVENTARIO */}
        {vista === 'catalogo' && (
          <div>
            <input 
              type="text" 
              placeholder="🔍 Buscar producto..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            
            <button 
              onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
              onClick={() => setEscaneando(true)} 
              style={{ ...btnStyle, width: '100%', padding: '15px', backgroundColor: '#2563eb', color: '#fff', borderRadius: '15px', fontWeight: 'bold', marginBottom: '20px' }}>
              📷 ESCANEAR CÓDIGO
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventarioFiltrado.map(p => (
                <div key={p.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{p.codigo_barras || 'S/C'}</p>
                  <p style={{ fontWeight: '700', margin: '5px 0' }}>{p.nombre}</p>
                  <p style={{ color: '#2563eb', fontWeight: '800', fontSize: '20px', margin: '5px 0' }}>${p.precio}</p>
                  
                  <button 
                    onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
                    onClick={() => {
                      setCarrito([...carrito, p]);
                    }}
                    style={{ ...btnStyle, width: '100%', padding: '10px', backgroundColor: '#10b981', color: '#fff', borderRadius: '10px', fontWeight: 'bold', marginTop: '5px' }}>
                    + AÑADIR {carrito.filter(item => item.id === p.id).length > 0 && `(${carrito.filter(item => item.id === p.id).length})`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: REGISTRO */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '25px' }}>
            <h3 style={{marginTop: 0}}>Nuevo Ingreso</h3>
            <button 
              onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
              onClick={() => setEscaneando(true)} 
              style={{ ...btnStyle, width: '100%', padding: '15px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '15px', marginBottom: '15px', fontWeight: 'bold' }}>
              📷 Escanear Código
            </button>
            <form onSubmit={guardarEnBD}>
              <input type="text" placeholder="Código" value={nuevoProd.codigo} readOnly style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc' }} />
              <input type="text" placeholder="Nombre" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #e2e8f0', borderRadius: '10px' }} />
              <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '10px' }} />
              <button 
                onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
                type="submit" 
                style={{ ...btnStyle, width: '100%', padding: '15px', backgroundColor: '#2563eb', color: '#fff', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}>
                GUARDAR PRODUCTO
              </button>
            </form>
          </div>
        )}

        {/* VISTA: CARRITO */}
        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '40px 20px', borderRadius: '30px', marginBottom: '20px' }}>
              <p style={{fontSize: '14px', opacity: 0.8}}>POR COBRAR</p>
              <h2 style={{ fontSize: '50px', margin: '10px 0' }}>${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
              <p>{carrito.length} prendas seleccionadas</p>
            </div>
            <button 
              onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
              onClick={async () => {
                const totalVenta = carrito.reduce((acc, p) => acc + p.precio, 0);
                if(totalVenta === 0) return;
                await supabase.from('ventas').insert([{ total: totalVenta, detalles: carrito.map(p => p.nombre).join(', ') }]);
                await supabase.from('productos').delete().in('id', carrito.map(p => p.id));
                setCarrito([]);
                obtenerTodo();
                setVista('historial');
                alert("✅ Venta Realizada");
              }}
              style={{ ...btnStyle, width: '100%', padding: '20px', backgroundColor: '#10b981', color: '#fff', borderRadius: '20px', fontWeight: '900', fontSize: '20px' }}>
              CONSOLIDAR VENTA
            </button>
            <button onClick={() => setCarrito([])} style={{ marginTop: '20px', color: '#94a3b8', border: 'none', background: 'none' }}>Vaciar Carrito</button>
          </div>
        )}
      </main>

      {/* MENÚ INFERIOR MEJORADO */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '15px', right: '15px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        {[
          {v: 'pos', i: '🛒'}, 
          {v: 'catalogo', i: '📦'}, 
          {v: 'admin', i: '➕'}, 
          {v: 'historial', i: '📈'}
        ].map(item => (
          <button 
            key={item.v}
            onPointerDown={(e) => eval(activeEffect)} onPointerUp={(e) => eval(normalEffect)}
            onClick={() => setVista(item.v)}
            style={{ 
              ...btnStyle, 
              fontSize: '24px', 
              padding: '10px 20px', 
              borderRadius: '15px',
              backgroundColor: vista === item.v ? '#eff6ff' : 'transparent',
              filter: vista === item.v ? 'none' : 'grayscale(1)'
            }}>
            {item.i}
          </button>
        ))}
      </nav>
    </div>
  );
}
