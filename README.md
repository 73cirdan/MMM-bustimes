# bustimes
Magic Mirror - Dutch bus times 

Based on a Dutch public api for public transport. Has three displaymodes as shown in mockup below.
![call](https://github.com/73cirdan/MMM-bustimes/blob/master/screenshot.png)
# Installation
Navigate into your MagicMirror's `modules` folder and execute
 'git clone https://github.com/73cirdan/MMM-bustimes bustimes'
# Using the module
## Get your timepointcode
This module can show one or more bus stops in your neighbourhood using timepoint code.
A timepoint code is a stop on e.g. a bus or metro line.
(more docs on: https://github.com/skywave/KV78Turbo-OVAPI/wiki/Line )

1. Use:
  http://v0.ovapi.nl/line/ 
  in a browser to find your line in all lines.
  (search the result for your line by city or line number).
  *First result in the resulting JSON e.g was ARR_28167_2.*

1. Use:
  http://v0.ovapi.nl/line/[lineid]
  in a browser to find the line stops and the correct direction.
  replace [lineid] with something in the form Operator_linenr_direction.
  check the timepointcode (tpc) for the stop you want to use.
  *Based on the example at step 1: http://v0.ovapi.nl/line/ARR_28167_2
  we find "TimingPointName":"Alde Leie, Brug","TimingPointCode":"20320110".*

1. Use:
  http://v0.ovapi.nl/tpc/[tpc]
  to replace [tpc] with something in the form of a 8digit number.
  Mind the change from **line** to **tpc** in the URL.
  *Based on the example in step 2 use: http://v0.ovapi.nl/tpc/20320110.*
  *Check the result. The passes part should contain busses, trams or boats stopping at this stop. All lines halting at this stop are included. If all looks good, copy the tpc into the config.*  

## Config options

First Header | Second Header
------------ | ------------- 
tpc | Just one tpc or a comma separated list "tpc1,tpc2" if you need more than one departure list
displaymode | is one of "small", "medium", "large".
.. | *large* - busline and time per row, display a number of *departs* rows per tpcs.
.. | *medium* - use <departs> to display a number of *departs* in one row, keep it low like 2 or 3
.. | *small* - just the next bus, no use of *departs*
departs | controls how many departs you want to see.

## Example config.js content for this module
		{
			module: "bustimes",
			position: "top_left",
                	header: "Bustimes",
			config: {
				timepointcode: "20320110,20141200",
				displaymode: "small",
				departs: 3 
			}
		},

The MIT License (MIT) 
===================== 
Copyright 2017 Cirdan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. **The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.** 

