#!/usr/bin/env node
// Run: node generate-icons.js
// Generates all required PWA icon sizes as PNG files

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = size * 0.18  // corner radius

  // Background rounded rect
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0d5c3a')
  grad.addColorStop(1, '#2da06e')
  ctx.fillStyle = grad
  ctx.fill()

  // Leaf
  const cx = size / 2, cy = size / 2, lh = size * 0.62
  ctx.beginPath()
  ctx.moveTo(cx, cy - lh / 2)
  ctx.bezierCurveTo(cx + lh * 0.45, cy - lh * 0.35, cx + lh * 0.45, cy + lh * 0.35, cx, cy + lh / 2)
  ctx.bezierCurveTo(cx - lh * 0.45, cy + lh * 0.35, cx - lh * 0.45, cy - lh * 0.35, cx, cy - lh / 2)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()

  // Vein
  ctx.beginPath()
  ctx.moveTo(cx, cy - lh / 2)
  ctx.lineTo(cx, cy + lh / 2)
  ctx.strokeStyle = 'rgba(13,92,58,0.3)'
  ctx.lineWidth = size * 0.025
  ctx.stroke()

  return canvas.toBuffer('image/png')
}

const iconsDir = path.join(__dirname, 'public', 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

SIZES.forEach(size => {
  const buf = drawIcon(size)
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), buf)
  console.log(`✓ icon-${size}x${size}.png`)
})
console.log('\nAll icons generated in public/icons/')
