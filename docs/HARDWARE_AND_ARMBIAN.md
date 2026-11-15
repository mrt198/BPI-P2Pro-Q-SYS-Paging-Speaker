# Hardware Wiring, Armbian Overlays & PoE Power Guide

This guide covers deploying `sbc/aes67_daemon.py` onto a **BananaPi BPI-P2Pro** (Rockchip RK3308, IEEE 802.3af PoE) or generic Armbian SBC.

## Recommended Hardware BOM

| Subsystem | Recommended Component | Interface | Notes |
| --- | --- | --- | --- |
| SBC | BananaPi BPI-P2Pro | PoE Ethernet | RK3308 quad Cortex-A35 with built-in PoE |
| Speaker Amp | MAX98357A or TAS5805M | I2S0 + `SD_MODE` GPIO | Or onboard RK3308 line-out codec |
| Room SPL Mic | ICS-43434 / INMP441 | I2S1 | Or onboard RK3308 ADC when fitted |
| Display | SSD1306 / SH1106 `128×64` | I2C0 (`0x3C`) | Auto-sleeps after idle timeout |
| Controls | 2× Tactile Buttons + EC11 Encoder | `libgpiod` GPIO | Optional on Room slave speakers |

## Default GPIO & Bus Mapping (BPI-P2Pro)

| Signal | Default GPIO / Bus | Function |
| --- | --- | --- |
| Program Cycle Button | `GPIO 17` (pull-up, falling edge) | Cycles `Program 1 → 2 → 3 → None → 1` |
| Calls Mode Button | `GPIO 27` (pull-up, falling edge) | Cycles `Stage → All → None` (respects `allowNoneCalls`) |
| Volume Encoder A (CLK) | `GPIO 22` | Quadrature rotary volume step |
| Volume Encoder B (DT) | `GPIO 23` | Quadrature direction sense |
| Amplifier Shutdown (`SD_MODE`) | `GPIO 24` | Pulled `LOW` in Idle / Low-Power schedule |
| OLED Screen | `/dev/i2c-0` (`0x3C`) | Status, Zone, Program, Calls, Volume & SPL |

All pins are configurable from the **Hardware & PoE Power** tab in the web console or in `/etc/aes67-pager/config.json`.

## Armbian Device Tree & PTPv2 Setup

`sbc/install-bpi-p2pro.sh` configures:

1. **`/boot/armbianEnv.txt`**: Enables `rk3308-i2c0`, `rk3308-i2s0-out`, and `rk3308-i2s1-in` overlays.
2. **IEEE-1588v2 PTP (`linuxptp`)**: Installs and enables `ptp4l` in slave-only UDPv4 E2E mode on Ethernet so AES67 RTP jitter buffers stay locked to the venue Grandmaster clock.
3. **PoE Power Optimization**:
   - Sets CPU frequency governor to `powersave` (`408 MHz` idle / `816 MHz` cap).
   - Disables Bluetooth and Wi-Fi services (`bluetooth.service`, `wpa_supplicant.service`) when powered over PoE Ethernet.
   - Pulls Class-D amplifier `SD_MODE` low during idle or scheduled off-hours windows.
   - Blanks the I2C OLED after the configured idle timeout.
