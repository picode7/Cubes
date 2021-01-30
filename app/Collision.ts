namespace Collision {
  export function rect_rect(r1x1, r1y1, r1x2, r1y2, r2x1, r2y1, r2x2, r2y2) {
    return !(r1x1 >= r2x2 || r1x2 <= r2x1 || r1y1 >= r2y2 || r1y2 <= r2y1)
  }

  export function circle_rect(cx, cy, cr, rx1, ry1, rx2, ry2) {
    if (rx1 - cr < cx && rx2 + cr > cx && ry1 - cr < cy && ry2 + cr > cy) {
      if (cy < ry1) {
        if (cx < rx1) {
          return circle_point(cx, cy, cr, rx1, ry1)
        } else if (cx > rx2) {
          return circle_point(cx, cy, cr, rx2, ry1)
        }
      } else if (cy > ry2) {
        if (cx < rx1) {
          return circle_point(cx, cy, cr, rx1, ry2)
        } else if (cx > rx2) {
          return circle_point(cx, cy, cr, rx2, ry2)
        }
      }
      return true
    }
    return false
  }

  export function circle_point(cx, cy, cr, px, py) {
    var dx = cx - px
    var dy = cy - py
    return dx * dx + dy * dy < cr * cr
  }
}
