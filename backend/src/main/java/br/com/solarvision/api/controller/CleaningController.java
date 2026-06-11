package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.CleaningDtos;
import br.com.solarvision.api.service.CleaningService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cleanings")
public class CleaningController {

    private final CleaningService cleaningService;

    public CleaningController(CleaningService cleaningService) {
        this.cleaningService = cleaningService;
    }

    @GetMapping
    public List<CleaningDtos.CleaningResponse> listCleanings() {
        return cleaningService.listCleanings();
    }

    @PostMapping
    public CleaningDtos.CleaningResponse createCleaning(@Valid @RequestBody CleaningDtos.CreateCleaningRequest request) {
        return cleaningService.createCleaning(request);
    }
}
